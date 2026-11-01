import {
  Bell,
  BookOpen,
  LibraryBig,
  CalendarDays,
  ClipboardCheck,
  Code2,
  FileVideo,
  GraduationCap,
  Milestone,
  Radio,
  UserRound,
  TrendingUp,
  Video,
  BrainCircuit,
  type LucideIcon,
} from 'lucide-react';

export type StudentModule = {
  path: string;
  label: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  group: 'Learning' | 'Resources' | 'Schedule' | 'Account';
  features: string[];
};

export const studentModules: StudentModule[] = [
  {
    path: 'assignments',
    label: 'Assignments',
    description: 'Review published work, submit responses and view feedback.',
    eyebrow: 'YOUR LEARNING',
    icon: ClipboardCheck,
    group: 'Learning',
    features: ['Assignment instructions and deadlines', 'Text or file submissions', 'Submission status and feedback'],
  },
  {
    path: 'courses',
    label: 'Courses',
    description: 'Browse published courses, lessons and learning materials.',
    eyebrow: 'YOUR LEARNING',
    icon: LibraryBig,
    group: 'Learning',
    features: ['Published courses', 'Course lessons and topics', 'Private learning materials'],
  },
  {
    path: 'journey',
    label: 'Learning journey',
    description: 'Follow a clear path through your learning milestones.',
    eyebrow: 'YOUR LEARNING',
    icon: Milestone,
    group: 'Learning',
    features: ['Subject-specific learning paths', 'Milestone objectives and time estimates', 'Demo progress and XP rewards'],
  },
  {
    path: 'coding',
    label: 'Coding practice',
    description: 'Build programming confidence through structured challenges and problem solving.',
    eyebrow: 'LEARNING SPACE',
    icon: Code2,
    group: 'Learning',
    features: ['Question library and difficulty filters', 'Problem statement and constraints', 'Code editor and language selector', 'Submission feedback and attempt history'],
  },
  {
    path: 'aptitude',
    label: 'Aptitude & reasoning',
    description: 'Practise quantitative aptitude, logical reasoning and analytical thinking.',
    eyebrow: 'LEARNING SPACE',
    icon: BrainCircuit,
    group: 'Learning',
    features: ['Topic-wise practice sets', 'Multiple-choice questions', 'Answer explanations', 'Accuracy and practice history'],
  },
  {
    path: 'assessments',
    label: 'Test papers',
    description: 'Attempt assessments and review your results in one place.',
    eyebrow: 'LEARNING SPACE',
    icon: ClipboardCheck,
    group: 'Learning',
    features: ['Available tests and instructions', 'Question navigation and timer', 'Submission confirmation', 'Scores and previous attempts'],
  },
  {
    path: 'videos',
    label: 'Video library',
    description: 'Revisit recorded learning videos and study at your own pace.',
    eyebrow: 'RESOURCE CENTRE',
    icon: Video,
    group: 'Resources',
    features: ['Video categories and search', 'Video details and playback', 'Recently watched items', 'Continue watching'],
  },
  {
    path: 'recordings',
    label: 'Class recordings',
    description: 'Catch up on previously conducted classes and revisit important lessons.',
    eyebrow: 'RESOURCE CENTRE',
    icon: FileVideo,
    group: 'Resources',
    features: ['Recorded class catalogue', 'Training-day grouping', 'Playback and resource details', 'Access based on assigned sessions'],
  },
  {
    path: 'live-sessions',
    label: 'Live sessions',
    description: 'Find scheduled learning sessions and join classes when they are available.',
    eyebrow: 'YOUR SCHEDULE',
    icon: Radio,
    group: 'Schedule',
    features: ['Upcoming live classes', 'Session details and trainer information', 'Join-session entry point', 'Past session references'],
  },
  {
    path: 'sessions',
    label: 'My sessions',
    description: 'Keep track of daily, upcoming, day-wise and past training sessions.',
    eyebrow: 'YOUR SCHEDULE',
    icon: CalendarDays,
    group: 'Schedule',
    features: ['Upcoming and daily sessions', 'Day 1, Day 2 and training-day views', 'Past sessions', 'Session date and time details'],
  },
  {
    path: 'notifications',
    label: 'Notifications',
    description: 'See important platform announcements and learning reminders.',
    eyebrow: 'YOUR ACCOUNT',
    icon: Bell,
    group: 'Account',
    features: ['Platform announcements', 'Session reminders', 'Read and unread states', 'Notification history'],
  },
  {
    path: 'progress',
    label: 'Learning progress',
    description: 'Review your practice activity, learning resources and assessment results.',
    eyebrow: 'YOUR LEARNING',
    icon: TrendingUp,
    group: 'Learning',
    features: ['Coding practice completion', 'Aptitude answer accuracy', 'Assessment history', 'Reviewed learning resources'],
  },
  {
    path: 'profile',
    label: 'My account',
    description: 'View and update the personal information you provided during registration.',
    eyebrow: 'YOUR ACCOUNT',
    icon: UserRound,
    group: 'Account',
    features: ['Personal details', 'Profile picture', 'Learning interests', 'Account preferences'],
  },
];

export const moduleGroups = [
  { label: 'Learning', icon: GraduationCap },
  { label: 'Resources', icon: BookOpen },
  { label: 'Schedule', icon: CalendarDays },
  { label: 'Account', icon: UserRound },
] as const;
