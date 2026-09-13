import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  updateAttendees,
  type UpdateAttendeesBody,
} from "../../src/services/life-group.service";
import { AppError } from "../../src/services/app-error";

/**
 * Tests unitarios de `updateAttendees` en `life-group.service.ts` (ADR-0018 D2).
 *
 * Cubre permisos contextuales (líder de ESTE grupo / supervisor / admin),
 * existencia de perfiles y rol elegible (`Asistente`/`Miembro`).
 * Sin Mongo real; sin console.log; sin any.
 */

vi.mock("../../src/realtime/socket", () => ({
  emitRealtimeInvalidation: vi.fn(),
}));

vi.mock("../../src/models/life-group.model", () => {
  const lifeGroupModel = {
    findById: vi.fn(),
  };
  return { default: lifeGroupModel };
});

vi.mock("../../src/models/user-profile.model", () => {
  const userProfileModel = {
    find: vi.fn(),
  };
  return { default: userProfileModel };
});

import LifeGroup from "../../src/models/life-group.model";
import UserProfile from "../../src/models/user-profile.model";

const lifeGroupFindById = LifeGroup.findById as unknown as ReturnType<typeof vi.fn>;
const userProfileFind = UserProfile.find as unknown as ReturnType<typeof vi.fn>;

type Chain = {
  populate: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  then: <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) => Promise<U>;
};

const chainableWith = (resolved: unknown): Chain => {
  const self = {} as Chain;
  self.populate = vi.fn(() => self);
  self.select = vi.fn(() => self);
  self.then = <U>(onfulfilled: (value: unknown) => U | PromiseLike<U>) =>
    Promise.resolve(resolved).then(onfulfilled);
  return self;
};

// ---- fixtures -----------------------------------------------------------

const GROUP_ID = "65a1f0c0c1d2a3b4f5e6f7a0";
const LEADER_PROFILE_ID = "65a1f0c0c1d2a3b4f5e6f7a1";
const SUPERVISOR_PROFILE_ID = "65a1f0c0c1d2a3b4f5e6f7a2";
const OTHER_LEADER_PROFILE_ID = "65a1f0c0c1d2a3b4f5e6f7a3";
const ATTENDEE_A_ID = "65a1f0c0c1d2a3b4f5e6f7b1";
const ATTENDEE_B_ID = "65a1f0c0c1d2a3b4f5e6f7b2";
const INELIGIBLE_PROFILE_ID = "65a1f0c0c1d2a3b4f5e6f7c1";
const UNKNOWN_ID = "65a1f0c0c1d2a3b4f5e6f7d1";

const buildMockGroup = (overrides: Record<string, unknown> = {}) => ({
  _id: GROUP_ID,
  supervisor: SUPERVISOR_PROFILE_ID,
  leader: LEADER_PROFILE_ID,
  attendees: [],
  save: vi.fn(),
  ...overrides,
});

const buildProfile = (
  _id: string,
  roleName: string,
  userRoles: string[] = [],
) => ({
  _id,
  role: { _id: `role-${roleName.toLowerCase()}`, name: roleName },
  user:
    userRoles.length > 0
      ? { _id: `user-${_id}`, roles: userRoles.map((name) => ({ _id: `role-${name.toLowerCase()}`, name })) }
      : null,
});

const resetMocks = () => {
  lifeGroupFindById.mockReset();
  userProfileFind.mockReset();
};

// ---- helpers ------------------------------------------------------------

const mockGroupAndProfiles = ({
  group = buildMockGroup(),
  profiles = [] as unknown[],
}: {
  group?: ReturnType<typeof buildMockGroup>;
  profiles?: unknown[];
}) => {
  // Primera llamada: findById del grupo (sin populate)
  lifeGroupFindById.mockResolvedValueOnce(group);
  // Segunda llamada: findById con populate para respuesta
  lifeGroupFindById.mockReturnValueOnce(chainableWith(group));
  // find(...).select("_id") y find(...).populate(...).populate(...) resuelven mismos perfiles
  userProfileFind.mockReturnValueOnce(chainableWith(profiles));
  userProfileFind.mockReturnValueOnce(chainableWith(profiles));
  return group;
};

describe("life-group.service — updateAttendees", () => {
  beforeEach(resetMocks);

  const validBody: UpdateAttendeesBody = {
    attendees: [ATTENDEE_A_ID, ATTENDEE_B_ID],
  };

  it("404 si el grupo no existe", async () => {
    lifeGroupFindById.mockResolvedValueOnce(null);

    await expect(
      updateAttendees(GROUP_ID, validBody, {
        profileId: LEADER_PROFILE_ID,
        roles: ["Lider"],
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Grupo de vida no encontrado",
    });
  });

  it("403 si el caller es líder de OTRO grupo", async () => {
    mockGroupAndProfiles({
      group: buildMockGroup({ leader: OTHER_LEADER_PROFILE_ID }),
      profiles: [
        buildProfile(ATTENDEE_A_ID, "Miembro"),
        buildProfile(ATTENDEE_B_ID, "Asistente"),
      ],
    });

    await expect(
      updateAttendees(GROUP_ID, validBody, {
        profileId: LEADER_PROFILE_ID,
        roles: ["Lider"],
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "No tienes permisos para esta acción",
    });
  });

  it("403 si el caller no es líder, supervisor ni admin/superadmin", async () => {
    mockGroupAndProfiles({
      profiles: [
        buildProfile(ATTENDEE_A_ID, "Miembro"),
        buildProfile(ATTENDEE_B_ID, "Asistente"),
      ],
    });

    await expect(
      updateAttendees(GROUP_ID, validBody, {
        profileId: ATTENDEE_A_ID,
        roles: ["Miembro"],
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "No tienes permisos para esta acción",
    });
  });

  it("400 si algún asistente no existe", async () => {
    mockGroupAndProfiles({
      profiles: [buildProfile(ATTENDEE_A_ID, "Miembro")],
    });

    await expect(
      updateAttendees(GROUP_ID, validBody, {
        profileId: LEADER_PROFILE_ID,
        roles: ["Lider"],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Uno o más asistentes no existen",
    });
  });

  it("400 si algún asistente no tiene rol elegible", async () => {
    mockGroupAndProfiles({
      profiles: [
        buildProfile(ATTENDEE_A_ID, "Miembro"),
        buildProfile(INELIGIBLE_PROFILE_ID, "Lider"),
      ],
    });

    await expect(
      updateAttendees(
        GROUP_ID,
        { attendees: [ATTENDEE_A_ID, INELIGIBLE_PROFILE_ID] },
        {
          profileId: LEADER_PROFILE_ID,
          roles: ["Lider"],
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: "Uno o más asistentes no tienen un rol elegible",
    });
  });

  it("200 happy path: líder de SU grupo actualiza roster vacío", async () => {
    const group = mockGroupAndProfiles({ profiles: [] });

    const result = await updateAttendees(
      GROUP_ID,
      { attendees: [] },
      {
        profileId: LEADER_PROFILE_ID,
        roles: ["Lider"],
      },
    );

    expect(group.save).toHaveBeenCalled();
    expect(result).toBe(group);
  });

  it("200 happy path: supervisor del grupo actualiza roster", async () => {
    const group = mockGroupAndProfiles({
      profiles: [
        buildProfile(ATTENDEE_A_ID, "Miembro"),
        buildProfile(ATTENDEE_B_ID, "Asistente"),
      ],
    });

    const result = await updateAttendees(GROUP_ID, validBody, {
      profileId: SUPERVISOR_PROFILE_ID,
      roles: ["Supervisor"],
    });

    expect(group.save).toHaveBeenCalled();
    expect(result).toBe(group);
  });

  it("200 happy path: Admin actualiza roster sin pertenecer al grupo", async () => {
    const group = mockGroupAndProfiles({
      profiles: [
        buildProfile(ATTENDEE_A_ID, "Miembro"),
        buildProfile(ATTENDEE_B_ID, "Asistente"),
      ],
    });

    const result = await updateAttendees(GROUP_ID, validBody, {
      profileId: UNKNOWN_ID,
      roles: ["Admin"],
    });

    expect(group.save).toHaveBeenCalled();
    expect(result).toBe(group);
  });

  it("acepta rol elegible también en user.roles (robustez)", async () => {
    const group = mockGroupAndProfiles({
      profiles: [
        // Perfil cuyo role primario es Lider pero user.roles incluye Miembro
        buildProfile(ATTENDEE_A_ID, "Lider", ["Miembro"]),
      ],
    });

    const result = await updateAttendees(
      GROUP_ID,
      { attendees: [ATTENDEE_A_ID] },
      {
        profileId: LEADER_PROFILE_ID,
        roles: ["Lider"],
      },
    );

    expect(group.save).toHaveBeenCalled();
    expect(result).toBe(group);
  });
});
