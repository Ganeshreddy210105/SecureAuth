import logging
import secrets
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from pydantic import EmailStr
from app.core.config import settings

logger = logging.getLogger(__name__)

# Check if email is configured, if not, print to console
def is_email_configured() -> bool:
    return bool(settings.MAIL_USERNAME and settings.MAIL_SERVER)

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=False
)

class EmailService:
    async def send_verification_email(self, email: str, code: str):
        subject = "Verify Your SecureAuth Account"
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #09090B; color: #F8FAFC; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #18181B; padding: 30px; border-radius: 8px; border: 1px solid #27272A;">
                    <h2 style="color: #7C3AED; margin-top: 0;">Welcome to SecureAuth!</h2>
                    <p>Thank you for signing up. Please verify your email address by using the 6-digit code below:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #06B6D4; background-color: #09090B; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0; border: 1px dashed #7C3AED;">
                        {code}
                    </div>
                    <p>This code will expire in 15 minutes. If you did not request this email, you can safely ignore it.</p>
                    <hr style="border-color: #27272A; margin: 25px 0;">
                    <p style="font-size: 12px; color: #A1A1AA;">SecureAuth Inc. - Premium JWT & OAuth Identity Platform</p>
                </div>
            </body>
        </html>
        """
        await self._send_email(email, subject, body)

    async def send_password_reset_email(self, email: str, token: str):
        reset_link = f"http://localhost:3000/forgot-password?token={token}"
        subject = "Reset Your SecureAuth Password"
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #09090B; color: #F8FAFC; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #18181B; padding: 30px; border-radius: 8px; border: 1px solid #27272A;">
                    <h2 style="color: #7C3AED; margin-top: 0;">Reset Your Password</h2>
                    <p>We received a request to reset the password for your SecureAuth account. Click the button below to proceed:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" style="background-color: #7C3AED; color: #F8FAFC; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p>Alternatively, you can copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; color: #3B82F6; font-size: 14px;">{reset_link}</p>
                    <p>This link will expire in 1 hour. If you did not request a password reset, please secure your account.</p>
                    <hr style="border-color: #27272A; margin: 25px 0;">
                    <p style="font-size: 12px; color: #A1A1AA;">SecureAuth Inc. - Premium JWT & OAuth Identity Platform</p>
                </div>
            </body>
        </html>
        """
        await self._send_email(email, subject, body)

    async def send_otp_email(self, email: str, code: str):
        subject = "Your SecureAuth OTP Verification Code"
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #09090B; color: #F8FAFC; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #18181B; padding: 30px; border-radius: 8px; border: 1px solid #27272A;">
                    <h2 style="color: #7C3AED; margin-top: 0;">OTP Verification Code</h2>
                    <p>Please use the verification code below to complete your sign-in request:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #06B6D4; background-color: #09090B; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0; border: 1px dashed #3B82F6;">
                        {code}
                    </div>
                    <p>This code will expire in 5 minutes. If you did not attempt to sign in, please ignore this email.</p>
                    <hr style="border-color: #27272A; margin: 25px 0;">
                    <p style="font-size: 12px; color: #A1A1AA;">SecureAuth Inc. - Premium JWT & OAuth Identity Platform</p>
                </div>
            </body>
        </html>
        """
        await self._send_email(email, subject, body)

    async def _send_email(self, email: str, subject: str, body: str):
        message = MessageSchema(
            subject=subject,
            recipients=[email],
            body=body,
            subtype=MessageType.html
        )
        
        # Log email content in console for development convenience
        logger.info(f"\n========================================\n"
                    f"EMAIL TO: {email}\n"
                    f"SUBJECT: {subject}\n"
                    f"BODY (TRUNCATED): {body[:300]}...\n"
                    f"========================================")
        
        if is_email_configured():
            try:
                fm = FastMail(conf)
                await fm.send_message(message)
                logger.info(f"Email successfully sent to {email}")
            except Exception as e:
                logger.error(f"Failed to send email via SMTP: {e}")
        else:
            logger.info("SMTP email server not configured or details missing. Email printed to console log.")

email_service = EmailService()
