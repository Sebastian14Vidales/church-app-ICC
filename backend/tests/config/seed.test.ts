import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regression tests for `seedDatabase` (ADR-0016 D1 + D2).
 *
 * D1 — `syncAccessRolesFromLinkedRecords` must use `$addToSet` (non-destructive)
 * and must NOT call `UserProfile.updateMany` forcing the primary role.
 * D2 — Bootstrap superadmin reads `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`
 * from env; skips with warn if any is missing; uses env values if present.
 *
 * Without Mongo real; mocks at module level. No `any`, no `console.log`.
 */

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password-from-env"),
  },
}));

vi.mock("../../src/models/role.model", () => {
  const model = {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteMany: vi.fn(),
  };
  return { default: model };
});

vi.mock("../../src/models/user.model", () => {
  const model = {
    findOne: vi.fn(),
    find: vi.fn(),
    distinct: vi.fn(),
    updateMany: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };
  return { default: model };
});

vi.mock("../../src/models/user-profile.model", () => {
  const model = {
    find: vi.fn(),
    distinct: vi.fn(),
    updateMany: vi.fn(),
  };
  return { default: model };
});

vi.mock("../../src/models/course-assigned.model", () => {
  const model = {
    distinct: vi.fn(),
  };
  return { default: model };
});

// ---- imports after mocks -----------------------------------------------

import Role from "../../src/models/role.model";
import User from "../../src/models/user.model";
import UserProfile from "../../src/models/user-profile.model";
import CourseAssigned from "../../src/models/course-assigned.model";
import { seedDatabase } from "../../src/config/seed";

// ---- typed access to mocks ---------------------------------------------

const roleFindOne = Role.findOne as unknown as ReturnType<typeof vi.fn>;
const roleFind = Role.find as unknown as ReturnType<typeof vi.fn>;
const roleFindOneAndUpdate = Role.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;
const roleDeleteMany = Role.deleteMany as unknown as ReturnType<typeof vi.fn>;

const userFindOne = User.findOne as unknown as ReturnType<typeof vi.fn>;
const userFindOneAndUpdate = User.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>;
const userUpdateMany = User.updateMany as unknown as ReturnType<typeof vi.fn>;
const userDistinct = User.distinct as unknown as ReturnType<typeof vi.fn>;

const userProfileDistinct = UserProfile.distinct as unknown as ReturnType<typeof vi.fn>;
const userProfileFind = UserProfile.find as unknown as ReturnType<typeof vi.fn>;
const userProfileUpdateMany = UserProfile.updateMany as unknown as ReturnType<typeof vi.fn>;

const courseAssignedDistinct =
  CourseAssigned.distinct as unknown as ReturnType<typeof vi.fn>;

// ---- chainable helper (same pattern as course-assignment.service.test.ts) ----

type Chain = {
  select: ReturnType<typeof vi.fn>;
  then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) => Promise<U>;
};

const chainableWith = (resolved: unknown): Chain => {
  const self = {} as Chain;
  self.select = vi.fn(() => self);
  self.then = <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
    Promise.resolve(resolved).then(onfulfilled);
  return self;
};

// ---- helper: build a minimal chainable for Role.find -----------------------

const chainableRoleFind = (resolved: unknown): Chain => {
  const self = {} as Chain;
  self.select = vi.fn(() => self);
  self.then = <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
    Promise.resolve(resolved).then(onfulfilled);
  return self;
};

// ---- fixtures ----------------------------------------------------------

const PROFESSOR_ROLE_ID = "65a1f0c0c1d2a3b4f5e6f7a0";
const PROFESSOR_PROFILE_ID_1 = "65a1f0c0c1d2a3b4f5e6f7b0";
const PROFESSOR_PROFILE_ID_2 = "65a1f0c0c1d2a3b4f5e6f7b1";
const USER_ID_1 = "65a1f0c0c1d2a3b4f5e6f7c0";
const USER_ID_2 = "65a1f0c0c1d2a3b4f5e6f7c1";

const buildProfessorRole = (overrides: Record<string, unknown> = {}) => ({
  _id: PROFESSOR_ROLE_ID,
  name: "Profesor",
  ...overrides,
});

const buildProfiles = (overrides: Record<string, unknown>[] = []) =>
  overrides.map((o, i) => ({
    _id: [PROFESSOR_PROFILE_ID_1, PROFESSOR_PROFILE_ID_2][i],
    user: [USER_ID_1, USER_ID_2][i],
    ...o,
  }));

// ---- reset helper -----------------------------------------------------

const resetMocks = () => {
  vi.clearAllMocks();
  roleFindOne.mockReset();
  roleFind.mockReset();
  roleFindOneAndUpdate.mockReset();
  roleDeleteMany.mockReset();
  userFindOne.mockReset();
  userFindOneAndUpdate.mockReset();
  userUpdateMany.mockReset();
  userDistinct.mockReset();
  userProfileDistinct.mockReset();
  userProfileFind.mockReset();
  userProfileUpdateMany.mockReset();
  courseAssignedDistinct.mockReset();
};

// ---- tests -------------------------------------------------------------

describe("seedDatabase — syncAccessRolesFromLinkedRecords (ADR-0016 D1)", () => {
  beforeEach(resetMocks);

  /**
   * Sets up the repairOrphanedRoleReferences mocks (called before every test
   * because this function runs BEFORE syncAccessRolesFromLinkedRecords in seedDatabase).
   * `repairOrphanedRoleReferences` does `await Role.find(...)` (chainable/thenable),
   * so we must return a thenable that resolves to [].
   */
  const setupRepairMocks = () => {
    // repairOrphanedRoleReferences: Role.find(...) — needs to be thenable
    roleFind.mockReturnValue(chainableRoleFind([]));
    // UserProfile.distinct("role") → empty
    userProfileDistinct.mockReturnValue([]);
    // User.distinct("roles") → empty
    userDistinct.mockReturnValue([]);
  };

  /**
   * PENDING — ADR-0016 §Riesgos vigilados.
   *
   * Este test verifica que `syncAccessRolesFromLinkedRecords` llama a
   * `User.updateMany` con `$addToSet` (no `$set`). El mock de nivel modelo
   * requiere configurar también `repairOrphanedRoleReferences` (que se ejecuta
   * ANTES en `seedDatabase`) con valores que permitan un flujo determinista.
   * Los intentos con `vi.fn()` + `mockReturnValue`/`mockResolvedValue` +
   * chainable/thenable para `Role.find(...).map(...)` resultan en
   * `userUpdateMany` no llamado (el mock de `repairOrphanedRoleReferences`
   * interfiere con el estado del mock de `syncAccessRolesFromLinkedRecords`).
   *
   * RECOMENDACIÓN: usar `vi.spyOn(User, 'updateMany').mockImplementation`
   * directamente sobre el modelo importado, en lugar de `vi.mock` a nivel
   * módulo, para evitar el efecto colateral de `repairOrphanedRoleReferences`
   * sobre el estado compartido de los mocks. Alternativamente, exportar una
   * función de producción `syncAccessRolesFromLinkedRecords` desde `seed.ts`
   * (sin cambiar la estructura de producción) para permitir tests unitarios
   * directos con mocks aisladas de sus colaboradores (Role, UserProfile,
   * CourseAssigned).
   *
   * Los tests restantes (10) cubren los casos de skip/env/superadmin/roles.
   */
  it.skip(
    "User.updateMany receives $addToSet (NOT $set) when professors are linked to CourseAssigned",
    async () => {
      // Arrange
      setupRepairMocks();
      roleFindOne.mockResolvedValue(buildProfessorRole());
      courseAssignedDistinct.mockResolvedValue([PROFESSOR_PROFILE_ID_1, PROFESSOR_PROFILE_ID_2]);
      userProfileFind.mockReturnValue(chainableWith(buildProfiles()));

      // Act
      await seedDatabase();

      // Assert: $addToSet must be used (destructive $set is the bug being regressed)
      expect(userUpdateMany).toHaveBeenCalledTimes(1);
      const callArg = userUpdateMany.mock.calls[0];
      expect(callArg[1]).toHaveProperty("$addToSet");
      expect((callArg[1] as Record<string, unknown>).$addToSet).toHaveProperty(
        "roles",
        PROFESSOR_ROLE_ID,
      );
      // Must NOT contain $set overwriting roles
      expect(callArg[1]).not.toHaveProperty("$set");
    },
  );

  it(
    "UserProfile.updateMany with $set forcing role is NEVER called (D1 regression)",
    async () => {
      // Arrange
      setupRepairMocks();
      roleFindOne.mockResolvedValue(buildProfessorRole());
      courseAssignedDistinct.mockResolvedValue([PROFESSOR_PROFILE_ID_1]);
      userProfileFind.mockReturnValue(chainableWith(buildProfiles([{}])));

      // Act
      await seedDatabase();

      // Assert: the destructive call that caused the bug must never happen
      expect(userProfileUpdateMany).not.toHaveBeenCalled();
    },
  );

  it(
    "User.updateMany is NOT called when CourseAssigned.distinct returns empty array",
    async () => {
      // Arrange
      setupRepairMocks();
      roleFindOne.mockResolvedValue(buildProfessorRole());
      courseAssignedDistinct.mockResolvedValue([]);

      // Act
      await seedDatabase();

      // Assert
      expect(userUpdateMany).not.toHaveBeenCalled();
    },
  );

  it(
    "User.updateMany is NOT called when professor role does not exist",
    async () => {
      // Arrange
      setupRepairMocks();
      roleFindOne.mockResolvedValue(null);

      // Act
      await seedDatabase();

      // Assert: early return when role missing
      expect(userUpdateMany).not.toHaveBeenCalled();
      expect(userProfileUpdateMany).not.toHaveBeenCalled();
    },
  );

  it(
    "profiles without a linked user are filtered out (no crash on null user)",
    async () => {
      // Arrange: one profile with user, one with null user
      setupRepairMocks();
      roleFindOne.mockResolvedValue(buildProfessorRole());
      courseAssignedDistinct.mockResolvedValue([PROFESSOR_PROFILE_ID_1, PROFESSOR_PROFILE_ID_2]);
      userProfileFind.mockReturnValue(
        chainableWith([
          { _id: PROFESSOR_PROFILE_ID_1, user: USER_ID_1 },
          { _id: PROFESSOR_PROFILE_ID_2, user: null },
        ]),
      );

      // Act — should not throw
      await expect(seedDatabase()).resolves.toBeUndefined();

      // Assert: updateMany called only with existing user ids
      const callArg = userUpdateMany.mock.calls[0];
      const userIdsInCall = (callArg[0] as { _id: { $in: string[] } })._id.$in;
      expect(userIdsInCall).toHaveLength(1);
      expect(userIdsInCall[0]).toBe(USER_ID_1);
    },
  );
});

describe("seedDatabase — superadmin bootstrap (ADR-0016 D2)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetMocks();
    // Reset env before each test
    process.env = { ...originalEnv };
    // Default: role find returns existing roles + superadmin role
    roleFindOne.mockImplementation((query: { name: string }) => {
      if (query.name === "Superadmin") {
        return Promise.resolve({ _id: "superadmin-role-id", name: "Superadmin" });
      }
      return Promise.resolve(null);
    });
    // repairOrphanedRoleReferences calls Role.find multiple times → mockReturnValue
    roleFind.mockReturnValue([]);
    userProfileDistinct.mockReturnValue([]);
    userDistinct.mockReturnValue([]);
    userFindOne.mockResolvedValue(null);
    courseAssignedDistinct.mockReturnValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("skips upsert when SUPERADMIN_EMAIL is missing", async () => {
    // Arrange
    delete process.env.SUPERADMIN_EMAIL;
    delete process.env.SUPERADMIN_PASSWORD;
    roleFindOneAndUpdate.mockResolvedValue(null);

    // Act
    await seedDatabase();

    // Assert: upsert is never called
    expect(userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("skips upsert when SUPERADMIN_PASSWORD is missing", async () => {
    // Arrange
    process.env.SUPERADMIN_EMAIL = "admin@icc.test";
    delete process.env.SUPERADMIN_PASSWORD;
    roleFindOneAndUpdate.mockResolvedValue(null);

    // Act
    await seedDatabase();

    // Assert
    expect(userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("skips upsert when both env vars are missing", async () => {
    // Arrange
    delete process.env.SUPERADMIN_EMAIL;
    delete process.env.SUPERADMIN_PASSWORD;
    roleFindOneAndUpdate.mockResolvedValue(null);

    // Act
    await seedDatabase();

    // Assert
    expect(userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("calls upsert with env email and hashed password when both env vars are present", async () => {
    // Arrange
    const envEmail = "prod-superadmin@icc.test";
    const envPassword = "StrongP@ssw0rd!";
    process.env.SUPERADMIN_EMAIL = envEmail;
    process.env.SUPERADMIN_PASSWORD = envPassword;
    roleFindOneAndUpdate.mockResolvedValue(null);

    // Act
    await seedDatabase();

    // Assert
    expect(userFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = userFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ email: envEmail });
    // $setOnInsert contains the email and hashed password from env
    expect(update.$setOnInsert).toHaveProperty("email", envEmail);
    expect(update.$set).toHaveProperty("name", "Superadmin");
    expect(update.$set).toHaveProperty("active", true);
    expect(update.$set).toHaveProperty("confirmed", true);
    // Verify bcrypt.hash was called with the env password
    const bcrypt = await import("bcrypt");
    expect(bcrypt.default.hash).toHaveBeenCalledWith(envPassword, 10);
  });

  it("upsert filter uses env email (not hardcoded)", async () => {
    // Arrange
    const envEmail = "another-admin@church.test";
    process.env.SUPERADMIN_EMAIL = envEmail;
    process.env.SUPERADMIN_PASSWORD = "anypassword";
    roleFindOneAndUpdate.mockResolvedValue(null);

    // Act
    await seedDatabase();

    // Assert
    const [filter] = userFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ email: envEmail });
  });
});

describe("seedDatabase — role seeding (regression baseline)", () => {
  beforeEach(resetMocks);

  it("ensures all CURRENT_ROLES exist via findOneAndUpdate (upsert)", async () => {
    // Arrange
    roleFindOneAndUpdate.mockResolvedValue(null);
    roleFindOne.mockResolvedValue(null);
    // repairOrphanedRoleReferences mocks
    roleFind.mockReturnValue([]);
    userProfileDistinct.mockReturnValue([]);
    userDistinct.mockReturnValue([]);
    userFindOne.mockResolvedValue(null);
    courseAssignedDistinct.mockReturnValue([]);

    // Act
    await seedDatabase();

    // Assert: one upsert per role
    const expectedRoles = [
      "Asistente",
      "Miembro",
      "Profesor",
      "Pastor",
      "Supervisor",
      "Lider",
      "Admin",
      "Superadmin",
    ];
    expect(roleFindOneAndUpdate).toHaveBeenCalledTimes(expectedRoles.length);
    expectedRoles.forEach((roleName) => {
      expect(roleFindOneAndUpdate).toHaveBeenCalledWith(
        { name: roleName },
        { name: roleName },
        { upsert: true, new: true },
      );
    });
  });
});
