import { createContext, useContext } from 'react'
import type { MinutesScope } from './minutes-drafts'

// 회의록 화면 안의 폼이 쓰던 글을 남길 자리(사람·회의). 갤러리처럼 자리가 없으면 남기지 않는다.
export const MinutesScopeContext = createContext<MinutesScope | null>(null)
export const useMinutesScope = () => useContext(MinutesScopeContext)
