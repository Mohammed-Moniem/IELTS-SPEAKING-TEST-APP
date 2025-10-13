export const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};
