import { authService } from '../features/auth/services/authService';
import { studentApi } from '../features/student/services/studentApi';
import type { DashboardActivity, DashboardAssignment, DashboardCourse, DashboardLiveClass, StudentDashboardData } from '../types/student';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const studentService = {
  async getDashboard(): Promise<StudentDashboardData> {
    const profile = authService.getCurrentStudentProfile();
    const [progress, courseData, assignmentData, classData, announcementData] = await Promise.all([
      studentApi<{
        courses: { id: string; title: string; subject: string; lessons_total: number; lessons_completed: number }[];
        assessmentAttempts: { submitted_at: string | null }[];
        assignmentSubmissions: { status: string }[];
        activity: DashboardActivity[];
      }>('/progress'),
      studentApi<{ courses: DashboardCourse[] }>('/courses'),
      studentApi<{ assignments: DashboardAssignment[] }>('/assignments'),
      studentApi<{ liveClasses: DashboardLiveClass[] }>('/live-classes'),
      studentApi<{ announcements: { id: string; title: string; body: string; published_at: string; read: boolean; course_title: string | null }[] }>('/announcements'),
    ]);
    const fullName = profile?.fullName?.trim() ?? '';
    const lessonsCompleted = progress.courses.reduce((total, course) => total + course.lessons_completed, 0);
    const lessonsTotal = progress.courses.reduce((total, course) => total + course.lessons_total, 0);
    const pendingAssignments = assignmentData.assignments.filter((assignment) => ['pending', 'overdue'].includes(assignment.student_status)).length;
    const submittedAssessments = progress.assessmentAttempts.filter((attempt) => attempt.submitted_at).length;

    return {
      greeting: getGreeting(),
      displayName: fullName || 'Student',
      stats: [
        { label: 'Lessons completed', value: String(lessonsCompleted), helper: `${lessonsTotal} published lessons in enrolled courses` },
        { label: 'Enrolled courses', value: String(progress.courses.length), helper: 'Courses opened by you' },
        { label: 'Assessments submitted', value: String(submittedAssessments), helper: 'Attempts submitted by you' },
        { label: 'Assignments due', value: String(pendingAssignments), helper: 'Published work awaiting submission' },
      ],
      quickActions: [
        { label: 'Published courses', description: 'Browse courses and lessons', route: '/student/courses', icon: 'code' },
        { label: 'Assignments', description: 'Submit work and see feedback', route: '/student/assignments', icon: 'brain' },
        { label: 'Test papers', description: 'View available assessments', route: '/student/assessments', icon: 'test' },
        { label: 'My sessions', description: 'View your training schedule', route: '/student/sessions', icon: 'calendar' },
      ],
      courses: courseData.courses,
      assignments: assignmentData.assignments,
      liveClasses: classData.liveClasses,
      activity: progress.activity,
      announcements: announcementData.announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        message: announcement.body,
        created_at: announcement.published_at,
        read: announcement.read,
        course_title: announcement.course_title,
      })),
    };
  },
};
