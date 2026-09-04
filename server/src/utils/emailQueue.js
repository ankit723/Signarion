import { Queue, Worker } from "bullmq";
import nodemailer from "nodemailer";
import redis from "./redis.js";

const emailQueue = new Queue("emailQueue", { connection: redis });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "varanasiartist.omg@gmail.com",
    pass: process.env.SMTP_PASS || "pcss ziab efff ovjq",
  },
});

new Worker(
  "emailQueue",
  async (job) => {
    const { to, subject, html } = job.data;
    await transporter.sendMail({
      from: `"App Auth" <${process.env.SMTP_FROM || "varanasiartist.omg@gmail.com"}>`,
      to,
      subject,
      html,
    });
  },
  { connection: redis }
);

export default emailQueue;