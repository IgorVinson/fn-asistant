export function classifyAvailabilityError(error) {
  if (error?.name === "WMAuthError") return "AVAILABILITY_AUTH_REQUIRED";
  return "SLOT_UNAVAILABLE";
}
