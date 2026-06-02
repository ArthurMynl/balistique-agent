/** Format IMAP envelope address lists for display (no Effect imports). */
export const formatMailAddresses = (
  addresses:
    | ReadonlyArray<{ readonly name?: string | undefined; readonly address?: string | undefined }>
    | undefined,
): string => {
  if (!addresses || addresses.length === 0) return "";

  return addresses
    .map((entry) => {
      const address = entry.address?.trim() ?? "";
      const name = entry.name?.trim() ?? "";
      if (name.length > 0 && address.length > 0) return `${name} <${address}>`;
      return address.length > 0 ? address : name;
    })
    .filter((line) => line.length > 0)
    .join(", ");
};
