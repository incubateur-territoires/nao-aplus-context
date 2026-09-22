import { fakerFR as faker } from "@faker-js/faker";

export interface AnonymizedUserData {
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  profession: null;
  internalSupportComment: null;
}

function generatePhone(): string {
  const prefix = faker.helpers.arrayElement(["06", "07"]);
  const suffix = faker.string.numeric(8);
  return `${prefix}${suffix}`;
}

/**
 * Builds pseudonymized data for an agent account being anonymized.
 *
 * The email is derived from the user id (`anonyme-<id>@anonymized.local`) so it
 * is guaranteed unique and never collides with the `User.email @unique`
 * constraint — even across batches and already-anonymized users.
 *
 * `profession` and `internalSupportComment` are erased (set to null) rather than
 * pseudonymized, as they carry no referential value.
 */
export function buildAnonymizedUserData(
  userId: string,
  original: { phone: string | null },
): AnonymizedUserData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email: `anonyme-${userId}@anonymized.local`,
    phone: original.phone ? generatePhone() : null,
    profession: null,
    internalSupportComment: null,
  };
}
