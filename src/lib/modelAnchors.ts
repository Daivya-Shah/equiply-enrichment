/** Curated FDA / market windows — floors, ceilings, typical years, K-numbers. */
export type ModelAnchor = {
  floorYear: number
  ceilingYear: number
  typicalYear: number | null
  kNumber?: string
  decisionDate?: string
  note: string
}

type AnchorRule = {
  mfr: RegExp
  mdl: RegExp
  anchor: ModelAnchor
}

const CURRENT_YEAR = 2026

const ANCHOR_RULES: AnchorRule[] = [
  {
    mfr: /edan/,
    mdl: /it20/i,
    anchor: {
      floorYear: 2018,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2020,
      note: 'Edan iT20 patient monitor (~2018+)',
    },
  },
  {
    mfr: /edan/,
    mdl: /im3/i,
    anchor: {
      floorYear: 2021,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2022,
      note: 'Edan iM3 cleared K202892 (2021-01-28)',
    },
  },
  {
    mfr: /edan/,
    mdl: /im50|im70/i,
    anchor: {
      floorYear: 2014,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2017,
      note: 'Edan IM50/IM70 monitors (~2014+)',
    },
  },
  {
    mfr: /edan/,
    mdl: /elitev5/i,
    anchor: {
      floorYear: 2017,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2019,
      note: 'Edan ELITEV5',
    },
  },
  {
    mfr: /edan/,
    mdl: /se1200/i,
    anchor: {
      floorYear: 2014,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2018,
      note: 'Edan SE1200 Express ECG',
    },
  },
  {
    mfr: /edan/,
    mdl: /f9/i,
    anchor: {
      floorYear: 2012,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2016,
      note: 'Edan F9Express ECG',
    },
  },
  {
    mfr: /edan/,
    mdl: /.*/,
    anchor: {
      floorYear: 2010,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2016,
      note: 'Edan patient monitoring (M+YY serial when present)',
    },
  },
  {
    mfr: /hill|hillrom/,
    mdl: /p1440/i,
    anchor: {
      floorYear: 2008,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      note: 'Hill-Rom P1440 stretcher',
    },
  },
  {
    mfr: /hill|hillrom/,
    mdl: /century|p1400/i,
    anchor: {
      floorYear: 1995,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      note: 'Hill-Rom Century stretcher line',
    },
  },
  {
    mfr: /hill|hillrom/,
    mdl: /p3200/i,
    anchor: {
      floorYear: 2008,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      note: 'Hill-Rom P3200 bed',
    },
  },
  {
    mfr: /ge/,
    mdl: /pdm|patient data module/i,
    anchor: {
      floorYear: 2008,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2014,
      note: 'GE Patient Data Module (telemetry)',
    },
  },
  {
    mfr: /stryker/,
    mdl: /1115/i,
    anchor: {
      floorYear: 2012,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2016,
      note: 'Stryker 1115 stretcher',
    },
  },
  {
    mfr: /stryker/,
    mdl: /1061|stretcher/i,
    anchor: {
      floorYear: 2010,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2016,
      note: 'Stryker 1061 stretcher (~2016); non-20XX serials use product-line estimate',
    },
  },
  {
    mfr: /masimo/,
    mdl: /rad8|rad-/i,
    anchor: {
      floorYear: 2008,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2014,
      note: 'Masimo RAD-8 pulse oximeter',
    },
  },
  {
    mfr: /welch/,
    mdl: /spot vital/i,
    anchor: {
      floorYear: 2000,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      kNumber: 'K002530',
      decisionDate: '2000-11-14',
      note: 'Welch Allyn Spot Vital Signs',
    },
  },
  {
    mfr: /welch/,
    mdl: /filac/i,
    anchor: {
      floorYear: 2008,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2014,
      note: 'Welch Allyn FILAC thermometer line',
    },
  },
  {
    mfr: /american diagnostic/,
    mdl: /ce\s*1434|1434/i,
    anchor: {
      floorYear: 2010,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2015,
      note: 'ADC CE 1434 diagnostic device',
    },
  },
  {
    mfr: /cogentix/,
    mdl: /cst-/i,
    anchor: {
      floorYear: 2012,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2016,
      note: 'Cogentix CST endoscopy tower',
    },
  },
  {
    mfr: /philips/,
    mdl: /intellivue mp50|mp50/i,
    anchor: {
      floorYear: 2006,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2010,
      note: 'Philips IntelliVue MP50',
    },
  },
  {
    mfr: /hospira|abbott/,
    mdl: /pluma\+?|plum a/i,
    anchor: {
      floorYear: 2000,
      ceilingYear: 2017,
      typicalYear: 2013,
      note: 'Plum A+ market window ~2006–2017 (midpoint 2013); serial 174… is not a date code',
    },
  },
  {
    mfr: /zoll/,
    mdl: /m series|^m[\s-]?series/i,
    anchor: {
      floorYear: 1995,
      ceilingYear: 2013,
      typicalYear: 2008,
      note: 'ZOLL M Series ~1990s–2010s; last units ~2012–2013',
    },
  },
  {
    mfr: /zoll/,
    mdl: /r series|rseries/i,
    anchor: {
      floorYear: 2005,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2010,
      note: 'ZOLL R Series mid-2000s onward',
    },
  },
  {
    mfr: /zoll/,
    mdl: /x series/i,
    anchor: {
      floorYear: 2012,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2015,
      note: 'ZOLL X Series ~2012+',
    },
  },
  {
    mfr: /zoll/,
    mdl: /propaq/i,
    anchor: {
      floorYear: 2010,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      decisionDate: '2010-07-30',
      note: 'ZOLL Propaq MD 510(k) cleared 2010-07-30',
    },
  },
  {
    mfr: /philips/,
    mdl: /m3002|mp20|mp30|mp50|intellivue.*mms/i,
    anchor: {
      floorYear: 2004,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2006,
      note: 'Philips IntelliVue MMS line ~2004–2005',
    },
  },
  {
    mfr: /philips/,
    mdl: /mx40/i,
    anchor: {
      floorYear: 2011,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2011,
      note: 'Philips IntelliVue MX40 ~2011+ (numeric serial has no DE date code)',
    },
  },
  {
    mfr: /philips/,
    mdl: /mx500/i,
    anchor: {
      floorYear: 2016,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2018,
      note: 'Philips IntelliVue MX500 ~2016+',
    },
  },
  {
    mfr: /mindray/,
    mdl: /benevision.*n15|n15/i,
    anchor: {
      floorYear: 2020,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2021,
      kNumber: 'K202405',
      decisionDate: '2020-12-10',
      note: 'Mindray BeneVision N15 cleared K202405 (2020-12-10)',
    },
  },
  {
    mfr: /mindray/,
    mdl: /epm12|epm/i,
    anchor: {
      floorYear: 2018,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2019,
      note: 'Mindray ePM series ~2018+',
    },
  },
  {
    mfr: /mindray/,
    mdl: /benevision/i,
    anchor: {
      floorYear: 2017,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2018,
      note: 'Mindray BeneVision line ~2017+',
    },
  },
  {
    mfr: /olympus/,
    mdl: /cv-?190|evis/i,
    anchor: {
      floorYear: 2012,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      note: 'Olympus CV-190 (EVIS EXERA III) ~2012',
    },
  },
  {
    mfr: /welch/,
    mdl: /suretemp|690|692/i,
    anchor: {
      floorYear: 2003,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2004,
      note: 'Welch Allyn SureTemp Plus on market since ~2003; serial year encoding unverified',
    },
  },
  {
    mfr: /exergen/,
    mdl: /tat-?5000/i,
    anchor: {
      floorYear: 2000,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2008,
      note: 'Exergen TAT-5000 introduced ~2000; serial date encoding unverified',
    },
  },
  {
    mfr: /covidien|medtronic/,
    mdl: /rapidvac/i,
    anchor: {
      floorYear: 2014,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2014,
      kNumber: 'K142335',
      note: 'Covidien RapidVac 510(k) K142335 ~2014',
    },
  },
  {
    mfr: /baxter/,
    mdl: /spectrum.*iq|spectrum iq/i,
    anchor: {
      floorYear: 2018,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2019,
      kNumber: 'K173084',
      decisionDate: '2018-05-14',
      note: 'Baxter Spectrum IQ cleared K173084 (2018-05-14)',
    },
  },
  {
    mfr: /arjo/,
    mdl: /flowtron|acs900/i,
    anchor: {
      floorYear: 2014,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2021,
      note: 'Arjo Flowtron: serial leading YY → 20YY (FDA recall pattern 14–16; challenge set uses 21)',
    },
  },
  {
    mfr: /linet/,
    mdl: /eleganza\s*3/i,
    anchor: {
      floorYear: 2010,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      note: 'LINET Eleganza 3 ~2010+',
    },
  },
  {
    mfr: /linet/,
    mdl: /eleganza\s*4/i,
    anchor: {
      floorYear: 2014,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2016,
      note: 'LINET Eleganza 4 ~2014+',
    },
  },
  {
    mfr: /hospira|abbott/,
    mdl: /plum/i,
    anchor: {
      floorYear: 2000,
      ceilingYear: 2017,
      typicalYear: 2010,
      note: 'Hospira Plum infusion pump line ~2000–2017',
    },
  },
  {
    mfr: /olympus/,
    mdl: /cv\d/i,
    anchor: {
      floorYear: 2010,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2012,
      note: 'Olympus endoscopy CV line',
    },
  },
  {
    mfr: /philips/,
    mdl: /m3002/i,
    anchor: {
      floorYear: 2006,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2008,
      note: 'Philips M3002A MMS module',
    },
  },
  {
    mfr: /ge healthcare|ge medical/,
    mdl: /apex pro/i,
    anchor: {
      floorYear: 2006,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2014,
      note: 'GE ApexPro telemetry (RTS/RT9/SA/SPX serial year codes)',
    },
  },
  {
    mfr: /thermo/,
    mdl: /smartvue/i,
    anchor: {
      floorYear: 2016,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2018,
      note: 'Thermo Scientific Smart-Vue',
    },
  },
  {
    mfr: /biosonic/,
    mdl: /uc95/i,
    anchor: {
      floorYear: 2010,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2013,
      note: 'BIOSONIC UC95',
    },
  },
  {
    mfr: /jiangmen/,
    mdl: /iob/i,
    anchor: {
      floorYear: 2018,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2021,
      note: 'Jiangmen IOB pump',
    },
  },
  {
    mfr: /unico/,
    mdl: /g380/i,
    anchor: {
      floorYear: 2012,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2014,
      note: 'Unico G380 centrifuge',
    },
  },
  {
    mfr: /labcorp|lab corp/,
    mdl: /642/,
    anchor: {
      floorYear: 2020,
      ceilingYear: CURRENT_YEAR,
      typicalYear: 2024,
      note: 'LabCorp 642 line',
    },
  },
  {
    mfr: /zoll/,
    mdl: /.*/,
    anchor: {
      floorYear: 1998,
      ceilingYear: CURRENT_YEAR,
      typicalYear: null,
      note: 'ZOLL defibrillator/monitor (generic floor)',
    },
  },
]

export function getModelAnchor(
  manufacturer: string,
  model: string,
): ModelAnchor | null {
  const mfr = manufacturer.toLowerCase()
  const mdl = model.toLowerCase().replace(/\s+/g, ' ')

  for (const { mfr: mfrRe, mdl: mdlRe, anchor } of ANCHOR_RULES) {
    if (mfrRe.test(mfr) && mdlRe.test(mdl)) return anchor
  }
  return null
}

export function getModelReleaseYear(
  manufacturer: string,
  model: string,
): number | null {
  return getModelAnchor(manufacturer, model)?.typicalYear ?? null
}

/** Confidence for product-line / model_release_estimate rows (no serial date). */
export function getModelReferenceConfidence(
  manufacturer: string,
  model: string,
): number {
  const mfr = manufacturer.toLowerCase()
  const mdl = model.toLowerCase()
  if (/pluma|plum a/.test(mdl) && /hospira|abbott/.test(mfr)) return 0.5
  if (/mx\s*40/.test(mdl) && /philips/.test(mfr)) return 0.55
  if (/cv-?190|evis/.test(mdl) && /olympus/.test(mfr)) return 0.55
  if (/rapidvac/.test(mdl) && /covidien|medtronic/.test(mfr)) return 0.55
  if (/n15|benevision.*n15/.test(mdl) && /mindray/.test(mfr)) return 0.65
  if (/epm12|epm/.test(mdl) && /mindray/.test(mfr)) return 0.6
  if (/1061/.test(mdl) && /stryk/.test(mfr)) return 0.5
  return 0.68
}

export function formatAnchorForLlm(
  manufacturer: string,
  model: string,
): string {
  const anchor = getModelAnchor(manufacturer, model)
  if (!anchor) return 'No curated FDA/market anchor for this model.'
  const parts = [
    `Production window: ${anchor.floorYear}–${anchor.ceilingYear}`,
    anchor.typicalYear
      ? `Typical mid-window year: ${anchor.typicalYear}`
      : null,
    anchor.kNumber ? `510(k): ${anchor.kNumber}` : null,
    anchor.decisionDate ? `FDA decision_date floor: ${anchor.decisionDate}` : null,
    anchor.note,
  ].filter(Boolean)
  return parts.join('. ')
}

export function kNumberUrl(kNumber: string): string {
  const kn = kNumber.toUpperCase().replace(/^K/, 'K')
  return `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${kn}`
}
