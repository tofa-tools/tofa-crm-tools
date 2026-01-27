/**
 * Message Formatting Utility
 * 
 * Replaces template placeholders with actual data for white-label messaging.
 */

export interface MessageData {
  playerName?: string;
  centerName?: string;
  academyName?: string;
  batchName?: string;
  returnDate?: string;
  returnDateFormatted?: string;
  preferenceLink?: string;
  parentName?: string;
  [key: string]: string | undefined;
}

/**
 * Formats a message template by replacing placeholders with actual data.
 * 
 * Placeholders use double curly braces: {{playerName}}, {{academyName}}, etc.
 * 
 * @param template - The message template with placeholders
 * @param data - Object containing values to replace placeholders
 * @returns Formatted message string
 * 
 * @example
 * formatMessage("Hi {{playerName}}!", { playerName: "John" })
 * // Returns: "Hi John!"
 */
export function formatMessage(template: string, data: MessageData): string {
  let formatted = template;
  
  // Replace all placeholders in the format {{key}}
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== undefined && value !== null) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      formatted = formatted.replace(placeholder, String(value));
    }
  });
  
  return formatted;
}

/**
 * Generates a WhatsApp link with a formatted message.
 * 
 * @param phone - Phone number (will be cleaned of non-numeric characters)
 * @param message - Pre-formatted message string (or template if data is provided)
 * @param data - Optional data to fill in placeholders if message is a template
 * @returns WhatsApp URL
 */
export function generateWhatsAppLink(
  phone: string,
  message: string,
  data?: MessageData
): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedMessage = data ? formatMessage(message, data) : message;
  const encodedMessage = encodeURIComponent(formattedMessage);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

