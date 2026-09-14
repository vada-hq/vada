export const SCREEN = 'EVT-TASK-01'
export const NODE = {
  addTask: '25:1280',
  event: '25:1331',
  alerts: '25:1352',
  scope: '25:1379',
  columns: ['25:1392', '25:1433', '25:1505', '25:1536'],
} as const
export const ASSET = {
  addTask: '25:1281',
  workspaceStatus: { startAt: '25:1318' } as Record<string, string>,
  alertByField: {
    delayedCount: '25:1354',
    reviewCount: '25:1361',
    mineCount: '25:1367',
    unassignedCount: '25:1373',
  } as Record<string, string>,
  cardDate: '25:1410',
  cardDateOverdue: '25:1476',
  cardDocument: '25:1457',
} as const
