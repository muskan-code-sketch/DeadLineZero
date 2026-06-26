import { Task } from "../types";

export interface WorkloadTemplate {
  name: string;
  description: string;
  icon: string;
  tasks: Task[];
}

export const getWorkloadTemplates = (todayStr: string): WorkloadTemplate[] => {
  const getRelativeDate = (daysAhead: number): string => {
    const d = new Date(todayStr);
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  return [
    {
      name: "🎓 Student Final Exams",
      description: "A heavy workload with short deadlines, papers, and study schedules.",
      icon: "graduation-cap",
      tasks: [
        {
          id: "student-1",
          title: "Complete History Term Paper",
          deadline: getRelativeDate(2),
          duration: 6,
          importance: "high",
          impact: "Course grade drops by a whole letter",
          status: "pending"
        },
        {
          id: "student-2",
          title: "Study for Calculus Final",
          deadline: getRelativeDate(4),
          duration: 10,
          importance: "high",
          impact: "Fail the course and must retake in summer",
          status: "pending"
        },
        {
          id: "student-3",
          title: "Write Biology Lab Summary",
          deadline: getRelativeDate(3),
          duration: 3,
          importance: "medium",
          impact: "Lose 5% easy participation points",
          status: "pending"
        },
        {
          id: "student-4",
          title: "Return rented textbooks",
          deadline: getRelativeDate(1),
          duration: 1,
          importance: "low",
          impact: "Charged a late fee of $45",
          status: "pending"
        },
        {
          id: "student-5",
          title: "Email advisor about fall schedule",
          deadline: getRelativeDate(6),
          duration: 2,
          importance: "medium",
          impact: "Classes might fill up, delaying graduation",
          status: "pending"
        }
      ]
    },
    {
      name: "🚀 Product Launch Week",
      description: "Critical bug fixes, investor pitches, and marketing timelines.",
      icon: "rocket",
      tasks: [
        {
          id: "startup-1",
          title: "Fix critical Stripe checkout crash",
          deadline: getRelativeDate(1),
          duration: 5,
          importance: "high",
          impact: "Active users cannot upgrade, direct revenue loss",
          status: "pending"
        },
        {
          id: "startup-2",
          title: "Polishing Pitch Deck for VCs",
          deadline: getRelativeDate(3),
          duration: 8,
          importance: "high",
          impact: "Miss seed funding opportunity, run out of runway",
          status: "pending"
        },
        {
          id: "startup-3",
          title: "Draft launch changelog & blog post",
          deadline: getRelativeDate(2),
          duration: 2,
          importance: "medium",
          impact: "Users don't know what new features exist",
          status: "pending"
        },
        {
          id: "startup-4",
          title: "Prepare launch day support templates",
          deadline: getRelativeDate(2),
          duration: 3,
          importance: "low",
          impact: "Delayed support responses on release day",
          status: "pending"
        },
        {
          id: "startup-5",
          title: "Social media announcement graphics",
          deadline: getRelativeDate(1),
          duration: 2,
          importance: "medium",
          impact: "Lower viral traction on launch day",
          status: "pending"
        }
      ]
    },
    {
      name: "🏡 Life & Move Organizer",
      description: "Packing checklists, lease reviews, and moving logistics.",
      icon: "home",
      tasks: [
        {
          id: "move-1",
          title: "Sign new lease & pay security deposit",
          deadline: getRelativeDate(1),
          duration: 2,
          importance: "high",
          impact: "Lose the apartment to another applicant",
          status: "pending"
        },
        {
          id: "move-2",
          title: "Pack living room & kitchen boxes",
          deadline: getRelativeDate(3),
          duration: 8,
          importance: "high",
          impact: "Moving truck arrives and things are unpacked",
          status: "pending"
        },
        {
          id: "move-3",
          title: "Set up electricity and internet utilities",
          deadline: getRelativeDate(2),
          duration: 3,
          importance: "medium",
          impact: "No lights or Wi-Fi for first 3 days in new home",
          status: "pending"
        },
        {
          id: "move-4",
          title: "Clean old apartment for deposit return",
          deadline: getRelativeDate(4),
          duration: 5,
          importance: "medium",
          impact: "Landlord retains full $1,500 security deposit",
          status: "pending"
        },
        {
          id: "move-5",
          title: "Redirect postal mailing address",
          deadline: getRelativeDate(5),
          duration: 1,
          importance: "low",
          impact: "Miss utility bills and bank statements",
          status: "pending"
        }
      ]
    }
  ];
};
