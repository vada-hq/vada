export const MY_INFO_NODE = {
  save: '630:8',
  name: '631:4',
  studentNumber: '631:11',
  schoolName: '631:18',
  college: '631:25',
  department: '631:33',
  currentGrade: '631:40',
  belonging: '631:2273',
} as const

export const MY_INFO_INPUTS = [
  MY_INFO_NODE.name,
  MY_INFO_NODE.studentNumber,
  MY_INFO_NODE.schoolName,
] as const

export const MY_INFO_SELECTS = [
  MY_INFO_NODE.college,
  MY_INFO_NODE.department,
  MY_INFO_NODE.currentGrade,
] as const

export const MY_INFO_CHEVRON: Record<string, string> = {
  college: '631:2293',
  department: '631:2295',
  currentGrade: '631:2297',
}
