// Map API field keys to friendly labels (extend as you add fields)
const LABELS = {
    username: "Username",
    first_name: "First Name",
    last_name: "Last Name",
    password: "Password",
    confirm_password: "Confirm Password",
    detail: "Error",
    non_field_errors: "Error",
  };
  
  // Normalize a DRF-style error payload to { field -> [messages] } and a readable string
  export function normalizeApiErrors(payload) {
    const fieldErrors = {};
    const lines = [];
  
    if (!payload || typeof payload !== "object") {
      return { fieldErrors, message: "Something went wrong. Please try again." };
    }
  
    for (const [key, value] of Object.entries(payload)) {
      const label = LABELS[key] || key.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
      const messages = Array.isArray(value) ? value : [String(value || "")].filter(Boolean);
  
      if (messages.length) {
        fieldErrors[key] = messages;
        lines.push(`${label}: ${messages.join(", ")}`);
      }
    }
  
    const message = lines.join("\n") || "Please fix the highlighted fields.";
    return { fieldErrors, message };
  }
  
  // Helper: get first error text for a field
  export function firstError(fieldErrors, field) {
    const arr = fieldErrors?.[field];
    return Array.isArray(arr) && arr.length ? arr[0] : "";
  }
  