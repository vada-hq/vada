import { encode } from 'uqr'

// QR 칸(true = 검정). 오류 정정 M, 여백 2칸이다. 휴대폰 화면을 찍을 때 반사·기울기를 견디는 보통 수준이다.
export const qrMatrix = (text: string): boolean[][] => encode(text, { ecc: 'M', border: 2 }).data
