import hashlib
import io
import json
import logging
import shutil
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RETRY_EVERY_SECONDS = 30
DOWNLOAD_TIMEOUT_SECONDS = 60
REQUIRED_FILES = ("shelters.json", "flood_prone.geojson")
ZIP_NAME = "cache-pack.zip"
UNPACKED_DIR = "files"


class InvalidCachePack(Exception):
    pass


def _is_safe_relative_path(path: str) -> bool:
    parts = PurePosixPath(path).parts
    return bool(parts) and not PurePosixPath(path).is_absolute() and ".." not in parts


def _read_manifest(raw: bytes) -> dict[str, Any]:
    try:
        manifest = json.loads(raw)
        files = manifest["files"]
        if manifest["v"] != 1 or not isinstance(files, dict):
            raise InvalidCachePack("unsupported manifest")
    except (ValueError, KeyError, TypeError) as error:
        raise InvalidCachePack(f"unreadable manifest: {error}") from error
    for name in REQUIRED_FILES:
        if name not in files:
            raise InvalidCachePack(f"manifest lists no {name}")
    if not all(_is_safe_relative_path(path) for path in files):
        raise InvalidCachePack("manifest lists a path outside the pack")
    return dict(manifest)


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


class CachePack:
    """The Cache Pack kept on this Node's disk: downloaded once, verified, served from disk."""

    def __init__(self, directory: Path) -> None:
        self._directory = directory
        self._unpacked = directory / UNPACKED_DIR
        self._manifest = self._verify_disk()

    @property
    def zip_path(self) -> Path:
        return self._directory / ZIP_NAME

    @property
    def manifest(self) -> dict[str, Any] | None:
        """The manifest of the pack on disk, or None when this Node has no valid pack."""
        return self._manifest

    def file(self, path: str) -> Path | None:
        """A file listed in the manifest, or None. Never a path the manifest does not list."""
        if self._manifest is None or path not in self._manifest["files"]:
            return None
        return self._unpacked / path

    def _verify_disk(self) -> dict[str, Any] | None:
        if not self._unpacked.exists() and not self.zip_path.exists():
            return None
        try:
            manifest = _read_manifest((self._unpacked / "manifest.json").read_bytes())
            for path, checksum in manifest["files"].items():
                if _sha256((self._unpacked / path).read_bytes()) != checksum:
                    raise InvalidCachePack(f"{path} does not match its checksum")
            if not self.zip_path.is_file():
                raise InvalidCachePack("the zip for other Nodes is missing")
        except (OSError, InvalidCachePack) as error:
            logger.warning("discarding the Cache Pack on disk: %s", error)
            self._discard()
            return None
        return manifest

    def install(self, zip_bytes: bytes) -> None:
        """Verify a downloaded pack and keep it. Raises InvalidCachePack and keeps nothing if it is bad."""
        try:
            archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
            manifest = _read_manifest(archive.read("manifest.json"))
            contents = {path: archive.read(path) for path in manifest["files"]}
        except (zipfile.BadZipFile, KeyError) as error:
            raise InvalidCachePack(f"incomplete pack: {error}") from error
        for path, content in contents.items():
            if _sha256(content) != manifest["files"][path]:
                raise InvalidCachePack(f"{path} does not match its checksum")

        self._discard()
        staging = self._directory / f"{UNPACKED_DIR}.staging"
        shutil.rmtree(staging, ignore_errors=True)
        for path, content in {**contents, "manifest.json": archive.read("manifest.json")}.items():
            target = staging / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        (self._directory / ZIP_NAME).write_bytes(zip_bytes)
        staging.rename(self._unpacked)
        self._manifest = manifest

    def _discard(self) -> None:
        self._manifest = None
        shutil.rmtree(self._unpacked, ignore_errors=True)
        self.zip_path.unlink(missing_ok=True)

    def download(self, url: str, client: httpx.Client) -> None:
        response = client.get(url)
        response.raise_for_status()
        self.install(response.content)
