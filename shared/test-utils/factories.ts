import { faker } from "@faker-js/faker";

export const UserFactory = {
  build: (overrides = {}) => ({
    id:        faker.string.uuid(),
    email:     faker.internet.email(),
    name:      faker.person.fullName(),
    role:      "user",
    createdAt: new Date().toISOString(),
    ...overrides,
  }),
};

export const BusinessFactory = {
  build: (overrides = {}) => ({
    id:          faker.string.uuid(),
    nameAr:      faker.company.name(),
    nameEn:      faker.company.name(),
    category:    "restaurant",
    city:        "Riyadh",
    lat:         24.7136,
    lng:         46.6753,
    ...overrides,
  }),
};

export const ReviewFactory = {
  build: (overrides = {}) => ({
    businessId: faker.string.uuid(),
    authorId:   faker.string.uuid(),
    rating:     faker.number.int({ min: 1, max: 5 }),
    bodyAr:     faker.lorem.paragraph(),
    bodyEn:     null,
    visitDate:  faker.date.recent().toISOString(),
    ...overrides,
  }),
};
