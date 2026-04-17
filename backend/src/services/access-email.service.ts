import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

type AccessEmailPayload = {
  email: string;
  name: string;
  token: string;
};

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  MAIL_FROM,
  APP_NAME,
  FRONTEND_URL,
} = process.env;

const FRONTEND_APP_URL = FRONTEND_URL ?? "http://localhost:5173";
const MAIL_APP_NAME = APP_NAME ?? "Iglesia Casa de Dios - Cruzada Cristiana";
const MAIL_SENDER = MAIL_FROM ?? SMTP_USER;

const toTitleCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getLogoPath = () => {
  const candidatePaths = [
    path.resolve(process.cwd(), "..", "frontend", "public", "logoICC.jpg"),
    path.resolve(process.cwd(), "frontend", "public", "logoICC.jpg"),
  ];

  return candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
};

const createTransporter = () => {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Faltan variables SMTP_HOST, SMTP_PORT, SMTP_USER o SMTP_PASS para enviar correos",
    );
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendAccessEmail = async ({
  email,
  name,
  subject,
  eyebrow,
  heading,
  intro,
  actionLabel,
  actionUrl,
  footerNote,
}: AccessEmailPayload & {
  subject: string;
  eyebrow: string;
  heading: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  footerNote: string;
}) => {
  const transporter = createTransporter();
  const normalizedName = toTitleCase(name);
  const logoPath = getLogoPath();
  const logoUrl = logoPath ? "cid:church-logo" : `${FRONTEND_APP_URL}/logoICC.jpg`;

  await transporter.sendMail({
    from: MAIL_SENDER,
    to: email,
    subject,
    text: [
      `Hola ${normalizedName},`,
      "",
      intro,
      "",
      `${actionLabel}: ${actionUrl}`,
      "",
      footerNote,
    ].join("\n"),
    html: `
      <div style="margin: 0; padding: 32px 16px; background: linear-gradient(180deg, #f6efe3 0%, #fffaf2 100%); font-family: 'Segoe UI', Arial, sans-serif; color: #31261b;">
        <div style="max-width: 640px; margin: 0 auto; text-align: center;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 88px; height: 88px; border-radius: 24px; background: rgba(255,255,255,0.92); box-shadow: 0 18px 40px rgba(90, 52, 20, 0.12); margin-bottom: 24px;">
            <img src="${logoUrl}" alt="Iglesia Casa de Dios - Cruzada Cristiana" style="width: 58px; height: 58px; object-fit: contain;" />
          </div>
          <div style="margin-bottom: 16px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #a16207; font-weight: 700;">
            ${eyebrow}
          </div>
          <h1 style="margin: 0 0 10px; font-size: 34px; line-height: 1.15; color: #7c2d12;">
            Iglesia Casa de Dios - Cruzada Cristiana
          </h1>
          <p style="margin: 0 0 28px; font-size: 18px; color: #5b4636;">
            Hola <strong>${normalizedName}</strong>, ${heading}
          </p>

          <div style="background: rgba(255,255,255,0.94); border-radius: 28px; padding: 32px 28px; box-shadow: 0 22px 54px rgba(120, 53, 15, 0.12);">
            <p style="margin: 0 0 18px; font-size: 16px; color: #4b5563;">
              ${intro}
            </p>
            <div style="margin-bottom: 24px;">
              <a href="${actionUrl}" style="display: inline-block; padding: 15px 32px; border-radius: 999px; background: linear-gradient(135deg, #ca8a04 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; box-shadow: 0 14px 30px rgba(202, 138, 4, 0.28);">
                ${actionLabel}
              </a>
            </div>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              ${footerNote}
            </p>
          </div>

          <p style="margin: 24px 0 0; font-size: 13px; color: #8b7355;">
            Si el boton no funciona, abre este enlace:
          </p>
          <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6;">
            <a href="${actionUrl}" style="color: #9a3412; word-break: break-all;">${actionUrl}</a>
          </p>
        </div>
      </div>
    `,
    attachments: logoPath
      ? [
          {
            filename: "logoICC.jpg",
            path: logoPath,
            cid: "church-logo",
          },
        ]
      : undefined,
  });
};

export const sendConfirmationEmail = async ({ email, name, token }: AccessEmailPayload) => {
  const confirmationUrl = `${FRONTEND_APP_URL}/confirm-account?token=${encodeURIComponent(token)}`;

  await sendAccessEmail({
    email,
    name,
    token,
    subject: `Activa tu cuenta en ${MAIL_APP_NAME}`,
    eyebrow: "Activación de cuenta",
    heading: "tu acceso ya esta casi listo.",
    intro: "Abre el enlace para activar tu cuenta y definir tu contraseña final.",
    actionLabel: "Activar mi cuenta",
    actionUrl: confirmationUrl,
    footerNote: "Si no esperabas este mensaje, puedes ignorarlo.",
  });
};

export const sendPasswordResetEmail = async ({ email, name, token }: AccessEmailPayload) => {
  const resetUrl = `${FRONTEND_APP_URL}/new-password?token=${encodeURIComponent(token)}`;

  await sendAccessEmail({
    email,
    name,
    token,
    subject: `Restablece tu contraseña en ${MAIL_APP_NAME}`,
    eyebrow: "Recuperación de acceso",
    heading: "recibimos una solicitud para cambiar tu contraseña.",
    intro: "Abre el enlace seguro para crear una nueva contraseña de acceso.",
    actionLabel: "Crear nueva contraseña",
    actionUrl: resetUrl,
    footerNote: "Si no solicitaste este cambio, ignora este correo.",
  });
};
