import logger from "../utils/logger.js";

class MailService {
  constructor() {
    // In a real implementation, this would integrate with
    // email services like SendGrid, AWS SES, etc.
    this.isEnabled = process.env.EMAIL_ENABLED === "true";
  }

  // Send welcome email
  async sendWelcomeEmail(user) {
    if (!this.isEnabled) {
      logger.debug("Email service disabled - skipping welcome email");
      return { success: true, skipped: true };
    }

    try {
      const subject = "Welcome to PetVerse!";
      const html = `
        <h1>Welcome to PetVerse, ${user.username}! 🎉</h1>
        <p>We're excited to have you join our community of pet collectors and battlers.</p>
        
        <h2>Getting Started:</h2>
        <ul>
          <li>🎁 Claim your daily free egg rolls</li>
          <li>⚔️ Battle other players to earn coins</li>
          <li>🔄 Fuse pets to create powerful new companions</li>
          <li>🏪 Trade pets in the marketplace</li>
        </ul>
        
        <p>If you have any questions, check out our FAQ or contact support.</p>
        
        <p>Happy collecting!<br>The PetVerse Team</p>
      `;

      await this.sendEmail(user.email, subject, html);

      logger.info(`Welcome email sent to ${user.email}`);
      return { success: true };
    } catch (error) {
      logger.error("Error sending welcome email:", error);
      return { success: false, error: error.message };
    }
  }

  // Send trade notification
  async sendTradeNotification(user, trade, type) {
    if (!this.isEnabled || !user.email) {
      return { success: true, skipped: true };
    }

    try {
      let subject, html;

      switch (type) {
        case "sold":
          subject = `Your pet ${trade.pet.name} has been sold!`;
          html = `
            <h1>Congratulations! 🎉</h1>
            <p>Your pet <strong>${trade.pet.name}</strong> has been sold for <strong>${trade.price} ${trade.currency}</strong>.</p>
            <p>Net amount received: <strong>${trade.netAmount} ${trade.currency}</strong></p>
          `;
          break;

        case "purchased":
          subject = `You've acquired ${trade.pet.name}!`;
          html = `
            <h1>New Pet Acquired! 🐾</h1>
            <p>You've successfully purchased <strong>${trade.pet.name}</strong> for <strong>${trade.price} ${trade.currency}</strong>.</p>
            <p>Check your collection to see your new companion!</p>
          `;
          break;

        default:
          return { success: false, error: "Unknown notification type" };
      }

      await this.sendEmail(user.email, subject, html);

      logger.info(`Trade notification sent to ${user.email}`);
      return { success: true };
    } catch (error) {
      logger.error("Error sending trade notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Send battle results
  async sendBattleResults(user, battleResult, rewards) {
    if (!this.isEnabled || !user.email) {
      return { success: true, skipped: true };
    }

    try {
      const subject = battleResult.victory
        ? "Battle Victory! 🏆"
        : "Battle Results";

      const html = `
        <h1>${battleResult.victory ? "Victory! 🏆" : "Battle Complete"}</h1>
        <p>Your recent battle has concluded.</p>
        
        <h2>Results:</h2>
        <ul>
          <li>Outcome: <strong>${
            battleResult.victory ? "Victory" : "Defeat"
          }</strong></li>
          <li>Coins Earned: <strong>${rewards.coins}</strong></li>
          <li>Experience: <strong>${rewards.experience}</strong></li>
          ${
            rewards.items.length > 0
              ? `<li>Items: ${rewards.items
                  .map((item) => item.type)
                  .join(", ")}</li>`
              : ""
          }
        </ul>
        
        <p>Keep battling to improve your skills and earn more rewards!</p>
      `;

      await this.sendEmail(user.email, subject, html);

      logger.info(`Battle results sent to ${user.email}`);
      return { success: true };
    } catch (error) {
      logger.error("Error sending battle results:", error);
      return { success: false, error: error.message };
    }
  }

  // Generic email sender (placeholder implementation)
  async sendEmail(to, subject, html) {
    // In a real implementation, this would use a service like:
    // - SendGrid
    // - AWS SES
    // - Nodemailer with SMTP
    // - etc.

    logger.debug(`[EMAIL] To: ${to}, Subject: ${subject}`);
    logger.debug(`[EMAIL] HTML: ${html.substring(0, 100)}...`);

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // For development, we'll just log the email
    if (process.env.NODE_ENV === "development") {
      console.log("=== EMAIL SIMULATION ===");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${html}`);
      console.log("========================");
    }

    return { success: true, simulated: true };
  }
}

export const mailService = new MailService();
export default mailService;
