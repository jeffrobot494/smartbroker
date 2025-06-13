/**
 * Handles user notifications - displays messages in the UI
 * Stage 1: Simple alert() implementation
 */
class NotificationService {
  /**
   * Show CSV error to user with simple alert
   * @param {Object} userInfo - User-friendly error information
   */
  showCSVError(userInfo) {
    // Stage 1: Simple alert with userMessage and helpText
    const message = userInfo.userMessage + '\n\n' + userInfo.helpText;
    alert(message);
  }

  /**
   * Show CSV success message
   * @param {string} message - Success message
   */
  showCSVSuccess(message) {
    // Stage 1: Simple alert for success
    alert(message);
  }
}