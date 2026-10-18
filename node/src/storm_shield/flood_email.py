import logging
import smtplib
import threading
from datetime import UTC, datetime, timedelta, timezone
from email.message import EmailMessage

from storm_shield.community_warning import CommunityWarning
from storm_shield.settings import Settings

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_SSL_PORT = 465
# A hung server must not leave a sender thread behind for the rest of the demo.
SMTP_TIMEOUT_SECONDS = 15
NEPAL_TIME = timezone(timedelta(hours=5, minutes=45))

SUBJECT = "ALERT OF FLOOD INCOMING!"


class FloodEmail:
    """The Hub's email to the team when it issues a new Community Warning.

    Optional and best effort: it needs internet, so it sits beside the Mesh warning and never
    stands in for it. A failed send is logged and nothing else happens.
    """

    def __init__(self, sender: str, app_password: str, recipients: list[str]) -> None:
        self._sender = sender
        self._app_password = app_password
        self._recipients = recipients

    @classmethod
    def from_settings(cls, settings: Settings) -> "FloodEmail | None":
        """None unless this is the Hub and all three email settings are set."""
        recipients = [
            address.strip() for address in settings.alert_email_to.split(",") if address.strip()
        ]
        if (
            settings.role != "hub"
            or not settings.alert_email_from
            or not settings.alert_email_app_password
            or not recipients
        ):
            return None
        return cls(settings.alert_email_from, settings.alert_email_app_password, recipients)

    def send_for(self, warning: CommunityWarning) -> None:
        """Send in the background so a slow SMTP server cannot delay the warning."""
        threading.Thread(target=self._deliver, args=(warning,), daemon=True).start()

    def _deliver(self, warning: CommunityWarning) -> None:
        try:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_SSL_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
                smtp.login(self._sender, self._app_password)
                smtp.send_message(self._message(warning))
        except (OSError, smtplib.SMTPException) as error:
            # Only the type: an SMTP error's text can echo the login.
            logger.warning(
                "could not email the flood alert for %s: %s", warning.origin, type(error).__name__
            )

    def _message(self, warning: CommunityWarning) -> EmailMessage:
        surge_time = datetime.fromtimestamp(warning.surge_t, UTC).astimezone(NEPAL_TIME)
        message = EmailMessage()
        message["Subject"] = SUBJECT
        message["From"] = self._sender
        message["To"] = ", ".join(self._recipients)
        message.set_content(
            f"{SUBJECT}\n\n"
            f"Node {warning.origin} reported a sudden rise in the river at "
            f"km {warning.origin_km:g}, at {surge_time:%H:%M} Nepal time. "
            "A flood may be coming down the river.\n\n"
            "This is a Storm Shield Community Warning, not an official alert. "
            "Open the Storm Shield dashboard to see the arrival estimate and the nearest open "
            "Shelter, and follow your official sources (DHM and your district) for instructions."
        )
        return message
