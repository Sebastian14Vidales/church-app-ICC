import Role from "../models/role.model";
import User from "../models/user.model";
import bycrpt from "bcrypt";

export const seedDatabase = async () => {
  const roles = [
    "Estudiante",
    "Miembro",
    "Profesor",
    "Pastor",
    "Admin",
    "Superadmin",
  ];

  for (const roleName of roles) {
    await Role.findOneAndUpdate(
      { name: roleName },
      { name: roleName },
      { upsert: true, new: true },
    );
  }

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
