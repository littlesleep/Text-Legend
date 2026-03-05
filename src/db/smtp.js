import { getSetting, setSetting } from './settings.js';

/**
 * 获取SMTP配置
 */
export async function getSmtpSettings() {
  const enabled = (await getSetting('smtp_enabled', 'false')) === 'true';
  const host = await getSetting('smtp_host', 'smtp.gmail.com');
  const port = await getSetting('smtp_port', '587');
  const secure = (await getSetting('smtp_secure', 'false')) === 'true';
  const user = await getSetting('smtp_user', '');
  const from = await getSetting('smtp_from', '');
  
  return {
    enabled,
    host,
    port: parseInt(port, 10),
    secure,
    user,
    password: '', // 不返回密码
    from
  };
}

/**
 * 保存SMTP配置
 */
export async function saveSmtpSettings(settings) {
  const {
    enabled = false,
    host = 'smtp.gmail.com',
    port = 587,
    secure = false,
    user = '',
    pass = '',
    from = ''
  } = settings;
  
  await setSetting('smtp_enabled', enabled ? 'true' : 'false');
  await setSetting('smtp_host', host);
  await setSetting('smtp_port', String(port));
  await setSetting('smtp_secure', secure ? 'true' : 'false');
  await setSetting('smtp_user', user);
  await setSetting('smtp_password', pass);
  await setSetting('smtp_from', from);
}

/**
 * 获取SMTP密码（不对外暴露）
 */
export async function getSmtpPassword() {
  return await getSetting('smtp_password', '');
}

/**
 * 测试SMTP连接
 */
export async function testSmtpConnection() {
  const settings = await getSmtpSettings();
  const password = await getSmtpPassword();
  
  if (!settings.enabled || !settings.host || !settings.user || !password) {
    throw new Error('SMTP配置不完整');
  }
  
  const nodemailer = await import('nodemailer');
  // 根据端口自动设置 secure：465 端口使用 SSL，其他端口使用 STARTTLS
  const useSecure = settings.secure || settings.port === 465;
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: useSecure,
    auth: {
      user: settings.user,
      pass: password
    }
  });
  
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    let errorMsg = error.message;
    if (errorMsg.includes('wrong version number') || errorMsg.includes('SSL')) {
      errorMsg = `SSL/TLS 配置错误。端口 ${settings.port} 与 secure 设置不匹配。建议：端口 587/25 使用 secure=false (STARTTLS)，端口 465 使用 secure=true (SSL)`;
    }
    throw new Error(`SMTP连接失败: ${errorMsg}`);
  }
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(email, resetUrl) {
  const settings = await getSmtpSettings();
  const password = await getSmtpPassword();
  
  if (!settings.enabled || !settings.host || !settings.user || !password) {
    throw new Error('邮件服务未配置');
  }
  
  const nodemailer = await import('nodemailer');
  // 根据端口自动设置 secure：465 端口使用 SSL，其他端口使用 STARTTLS
  const useSecure = settings.secure || settings.port === 465;
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: useSecure,
    auth: {
      user: settings.user,
      pass: password
    }
  });
  
  const mailOptions = {
    from: settings.from || settings.user,
    to: email,
    subject: '密码重置请求',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">密码重置</h2>
        <p>您收到这封邮件是因为有人请求重置您的账号密码。</p>
        <p>如果您没有发起此请求，请忽略此邮件。</p>
        <p>如果这是您发起的请求，请点击以下链接重置密码（链接有效期为30分钟）：</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            重置密码
          </a>
        </p>
        <p>或者复制以下链接到浏览器地址栏：</p>
        <p style="background-color: #f5f5f5; padding: 10px; word-break: break-all;">${resetUrl}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
      </div>
    `
  };
  
  await transporter.sendMail(mailOptions);
  return true;
}
