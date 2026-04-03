import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

type ConfirmationEmailPayload = {
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

export const sendConfirmationEmail = async ({
  email,
  name,
  token,
}: ConfirmationEmailPayload) => {
  const transporter = createTransporter();
  const normalizedName = toTitleCase(name);
  const activationUrl = `${FRONTEND_APP_URL}/confirm-account?email=${encodeURIComponent(email)}`;
  const logoPath = getLogoPath();
  const logoUrl = logoPath ? "cid:church-logo" : `${FRONTEND_APP_URL}/logoICC.jpg`;

  await transporter.sendMail({
    from: MAIL_SENDER,
    to: email,
    subject: `Activa tu cuenta en ${MAIL_APP_NAME}`,
    text: [
      `Hola ${normalizedName},`,
      "",
      `Tu código de confirmación es: ${token}`,
      "",
      "Por seguridad no enviamos contraseñas por correo.",
      "Usa este código para activar tu cuenta y definir tu contraseña final.",
      "",
      `Activa tu cuenta aquí: ${activationUrl}`,
      "",
      "Si no esperabas este correo, puedes ignorarlo.",
    ].join("\n"),
    html: `
      <div style="margin: 0; padding: 32px 16px; background: linear-gradient(180deg, #f6efe3 0%, #fffaf2 100%); font-family: 'Segoe UI', Arial, sans-serif; color: #31261b;">
        <div style="max-width: 640px; margin: 0 auto; text-align: center;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 88px; height: 88px; border-radius: 24px; background: rgba(255,255,255,0.92); box-shadow: 0 18px 40px rgba(90, 52, 20, 0.12); margin-bottom: 24px;">
            <img src="${logoUrl}" alt="Iglesia Casa de Dios - Cruzada Cristiana" style="width: 58px; height: 58px; object-fit: contain;" />
          </div>
          <div style="margin-bottom: 16px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #a16207; font-weight: 700;">
            Activación de cuenta
          </div>
          <h1 style="margin: 0 0 10px; font-size: 34px; line-height: 1.15; color: #7c2d12;">
            Iglesia Casa de Dios - Cruzada Cristiana
          </h1>
          <p style="margin: 0 0 28px; font-size: 18px; color: #5b4636;">
            Hola <strong>${normalizedName}</strong>, tu acceso ya está casi listo.
          </p>

          <div style="background: rgba(255,255,255,0.94); border-radius: 28px; padding: 32px 28px; box-shadow: 0 22px 54px rgba(120, 53, 15, 0.12);">
            <p style="margin: 0 0 18px; font-size: 16px; color: #4b5563;">
              Usa este código de 6 dígitos para confirmar tu cuenta y definir tu contraseña final:
            </p>
            <div style="margin: 0 auto 28px; display: inline-block; padding: 18px 26px; border-radius: 18px; background: linear-gradient(135deg, #7c2d12 0%, #c2410c 100%); color: #ffffff; font-size: 34px; font-weight: 800; letter-spacing: 10px;">
              ${token}
            </div>
            <div style="margin-bottom: 24px;">
              <a href="${activationUrl}" style="display: inline-block; padding: 15px 32px; border-radius: 999px; background: linear-gradient(135deg, #ca8a04 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; box-shadow: 0 14px 30px rgba(202, 138, 4, 0.28);">
                Validar mi cuenta
              </a>
            </div>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              Por seguridad no enviamos contraseñas por correo.
            </p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">
              Si no esperabas este mensaje, puedes ignorarlo.
            </p>
          </div>

          <p style="margin: 24px 0 0; font-size: 13px; color: #8b7355;">
            Si el botón no funciona, abre este enlace:
          </p>
          <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6;">
            <a href="${activationUrl}" style="color: #9a3412; word-break: break-all;">${activationUrl}</a>
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
