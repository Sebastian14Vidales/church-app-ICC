import Role from "../models/role.model";
import User from "../models/user.model";
import UserProfile from "../models/user-profile.model";
import bycrpt from "bcrypt";

export const seedDatabase = async () => {
  const allowedRoles = [
    "Asistente",
    "Miembro",
    "Profesor",
    "Pastor",
    "Admin",
    "Superadmin",
  ];

  for (const roleName of allowedRoles) {
    await Role.findOneAndUpdate(
      { name: roleName },
      { name: roleName },
      { upsert: true, new: true },
    );
  }

  const assistantRole = await Role.findOne({ name: "Asistente" });
  const obsoleteRoles = await Role.find({ name: { $nin: allowedRoles } });
  const obsoleteRoleIds = obsoleteRoles.map((role) => role._id);

  if (assistantRole && obsoleteRoleIds.length) {
    await UserProfile.updateMany(
      { role: { $in: obsoleteRoleIds } },
      { $set: { role: assistantRole._id } },
    );

    await User.updateMany(
      { roles: { $in: obsoleteRoleIds } },
      {
        $pull: { roles: { $in: obsoleteRoleIds } },
        $addToSet: { roles: assistantRole._id },
      },
    );

    await Role.deleteMany({ _id: { $in: obsoleteRoleIds } });
  }

  await UserProfile.updateMany(
    { baptized: { $exists: false } },
    { $set: { baptized: false } },
  );
  await UserProfile.updateMany(
    { servesInMinistry: { $exists: false } },
    { $set: { servesInMinistry: false } },
  );
  await UserProfile.updateMany(
    { ministry: { $exists: false } },
    { $set: { ministry: null } },
  );
  await UserProfile.updateMany(
    { ministryInterest: { $exists: false } },
    { $set: { ministryInterest: null } },
  );
  await UserProfile.updateMany(
    { spiritualGrowthStage: { $exists: false } },
    { $set: { spiritualGrowthStage: "Consolidación" } },
  );

  const superadminRole = await Role.findOne({ name: "Superadmin" });

  await User.findOneAndUpdate(
    { email: "vidales14sebastian@gmail.com" },
    {
      $set: {
        name: "Superadmin",
        active: true,
        confirmed: true,
        roles: superadminRole ? [superadminRole._id] : [],
      },
      $setOnInsert: {
        email: "vidales14sebastian@gmail.com",
        password: await bycrpt.hash("Superadmin1234", 10),
      },
    },
    { upsert: true, new: true },
  );
};
