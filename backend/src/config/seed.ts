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

  const superadminExists = await User.findOne({
    email: "vidales14sebastian@gmail.com",
  });

  if (!superadminExists) {
    const superadminRole = await Role.findOne({ name: "Superadmin" });

    await User.create({
      email: "vidales14sebastian@gmail.com",
      password: await bycrpt.hash("Superadmin1234", 10),
      confirmed: true,
      roles: [superadminRole?._id],
    });
    console.log("✅ Superadmin creado");
  }
};
