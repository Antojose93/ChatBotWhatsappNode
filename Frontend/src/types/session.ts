/** Status labels used by the UI; they intentionally differ from backend states. */
export type SessionStatus = 'Connected' | 'Logged Out' | 'Pending'
export interface Session { id: string; name: string; phone: string; status: SessionStatus }
export type SessionStatusFilter = 'All Statuses' | SessionStatus
