export type LearningInterest =
  | 'Coding and programming'
  | 'Non-coding activities'
  | 'Technical subjects'
  | 'Non-technical subjects';

export type StudentRegistration = {
  fullName: string;
  phone: string;
  email: string;
  profileImageName: string;
  profileImageDataUrl?: string;
  interests: LearningInterest[];
  passwordSetupCompleted: boolean;
  passwordSalt?: string;
  passwordHash?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthPurpose = 'register' | 'login' | 'reset' | 'migration';

export type StudentSession = {
  id?: string;
  email: string;
  role: 'student';
  createdAt: string;
  fullName?: string;
};
