export type LearningStat = {
  label: string;
  value: string;
  helper: string;
};

export type UpcomingSession = {
  id: string;
  title: string;
  topic: string;
  dateLabel: string;
  dayOfMonth: number;
  dateKey: string;
  timeLabel: string;
  trainer: string;
  status: 'Upcoming' | 'Live' | 'Completed';
  durationMinutes: number;
  description: string;
  format: 'Live class' | 'Practice session' | 'Workshop';
};

export type QuickAction = {
  label: string;
  description: string;
  route: string;
  icon: 'code' | 'brain' | 'test' | 'calendar';
};

export type DashboardCourse = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  thumbnail_key?: string | null;
  lesson_count: number;
  completed_lessons: number;
  enrolled: boolean;
};

export type DashboardAssignment = {
  id: string;
  title: string;
  subject: string;
  instructions: string;
  due_at: string | null;
  student_status: 'pending' | 'overdue' | 'submitted' | 'reviewed';
};

export type DashboardLiveClass = {
  id: string;
  title: string;
  subject: string;
  instructor: string;
  starts_at: string;
  session_status: 'scheduled' | 'live' | 'completed';
};

export type DashboardActivity = {
  activity_type: string;
  subject: string | null;
  occurred_at: string;
  course_id: string | null;
  node_id: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  course_title?: string | null;
};

export type StudentDashboardData = {
  greeting: string;
  displayName: string;
  stats: LearningStat[];
  quickActions: QuickAction[];
  courses: DashboardCourse[];
  assignments: DashboardAssignment[];
  liveClasses: DashboardLiveClass[];
  activity: DashboardActivity[];
  announcements: DashboardAnnouncement[];
};
