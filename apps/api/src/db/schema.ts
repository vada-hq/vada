// 조회용 표 정의다. 표는 마이그레이션(SQL)이 만들고, 이 파일들로 표를 만들지 않는다(다시 만들기 설계서).
// 표와 칸, 타입, NULL 여부만 맞춘다. 외래 키, UNIQUE, CHECK, EXCLUDE, 부분 유일 인덱스는 SQL에만 있다.
// 마이그레이션 DB와 같은지는 맞춤 시험이 확인한다.
// 바깥은 이 파일 하나로 불러 쓴다. 영역별 정의는 schema-*.ts에 있다.
export * from './schema-auth.js'
export * from './schema-org.js'
export * from './schema-money.js'
export * from './schema-work.js'
export * from './schema-records.js'
export * from './schema-shipments.js'
export * from './schema-schedule.js'
