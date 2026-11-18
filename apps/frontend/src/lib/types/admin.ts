export interface AdminDoctor {
  id: string;
  name: string;
  email: string;
  role: "doctor";
  disabled?: boolean;
}

export interface CreateDoctorInput {
  name: string;
  email: string;
}

export type DoctorInvitation = CreateDoctorInput;
