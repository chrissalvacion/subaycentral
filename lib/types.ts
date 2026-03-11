// ============================================================
// Shared TypeScript types – mirror the Supabase schema
// ============================================================

export type UserRole = "admin" | "faculty" | "intern";
export type DeploymentStatus = "upcoming" | "active" | "completed";
export type InternStatus = "pending" | "active" | "completed" | "withdrawn";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  student_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  required_hours: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerAgency {
  id: string;
  name: string;
  address: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  school_year: string | null;
  semester: string | null;
  start_date: string | null;
  end_date: string | null;
  required_hours: number;
  status: DeploymentStatus;
  created_at: string;
  updated_at: string;
  programs?: Program;
  deployment_faculty?: DeploymentFaculty[];
}

export interface DeploymentFaculty {
  id: string;
  deployment_id: string;
  faculty_id: string;
  created_at: string;
  profiles?: Profile;
}

export interface InternDeployment {
  id: string;
  intern_id: string;
  deployment_id: string;
  agency_id: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  required_hours: number | null;
  rendered_hours: number;
  status: InternStatus;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  deployments?: Deployment;
  partner_agencies?: PartnerAgency;
}

export interface DailyRecord {
  id: string;
  intern_id: string;
  intern_deployment_id: string;
  date: string;
  tasks: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeRecord {
  id: string;
  intern_id: string;
  intern_deployment_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  total_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  faculty_id: string | null;
  intern_id: string;
  intern_deployment_id: string;
  content: string;
  performance_rating: number | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile; // faculty profile
}
