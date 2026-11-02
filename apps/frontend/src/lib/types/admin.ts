export interface AdminDoctor {
  id: string;
  name: string;
  email: string;
  role: "doctor";
}

export interface CreateDoctorInput {
  name: string;
  email: string;
  password: string;
}
