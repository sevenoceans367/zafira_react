// Auto-generated from php/view_vessel_tankers.php
export const TANKER_PARTICULARS_LAYOUT = {
  "mainSections": [
    {
      "title": "Classification",
      "fields": [
        {
          "key": "selCLASS_SOC",
          "label": "Classification Society",
          "type": "select"
        },
        {
          "key": "txtClassNotation",
          "label": "Class notation",
          "type": "text"
        },
        {
          "key": "selPrevCLASS_SOC",
          "label": "If Classification society changed, name of previous society:",
          "type": "select"
        },
        {
          "key": "txtClassSOCChnageDate",
          "label": "If Classification society changed, date of change",
          "type": "text"
        },
        {
          "key": "txtIMOType",
          "label": "IMO type, if applicable",
          "type": "text"
        },
        {
          "key": "rdoIceClass",
          "label": "Does the vessel have ice class ?",
          "type": "radio"
        },
        {
          "key": "txtIceClass",
          "label": "Ice Class",
          "type": "text"
        },
        {
          "key": "txtDryDockDate",
          "label": "Date of last dry-dock",
          "type": "text"
        },
        {
          "key": "selDryDockPort",
          "label": "Place of last dry-dock",
          "type": "select"
        },
        {
          "key": "txtNextDryDockDate",
          "label": "Date next dry dock due",
          "type": "text"
        },
        {
          "key": "txtSurveyDate",
          "label": "Date of last special survey",
          "type": "text"
        },
        {
          "key": "txtDueSurveyDate",
          "label": "Due date of next special survey",
          "type": "text"
        },
        {
          "key": "txtAnnualSurveyDate",
          "label": "Date of last annual survey",
          "type": "text"
        },
        {
          "key": "txtOverallRating",
          "label": "If ship has Condition Assessment Program (CAP), what is the latest overall rating",
          "type": "text"
        },
        {
          "key": "rdoIsStatement",
          "label": "If yes, what is the expiry date?",
          "type": "radio"
        },
        {
          "key": "txtExpiryStatDate",
          "label": "Expiry date of statement of compliance issued under the provisions of the Condition Assessment Scheme",
          "type": "text"
        }
      ]
    },
    {
      "title": "Dimensions",
      "fields": [
        {
          "key": "txtLOA",
          "label": "Length Over All (LOA)(M)",
          "type": "text"
        },
        {
          "key": "txtLBPLength",
          "label": "Length Between Perpendiculars (LBP)(M)",
          "type": "text"
        },
        {
          "key": "txtBeam",
          "label": "Extreme breadth (Beam)(M)",
          "type": "text"
        },
        {
          "key": "txtMDepth",
          "label": "Moulded depth (M)",
          "type": "text"
        },
        {
          "key": "txtKeelKTM",
          "label": "Keel to Masthead (KTM)(M)",
          "type": "text"
        },
        {
          "key": "txtKtmCollapsed",
          "label": "KTM in collapsed condition (if applicable)(M)",
          "type": "text"
        },
        {
          "key": "txtBCenterManifold",
          "label": "Bow to Center Manifold (BCM)(M)",
          "type": "text"
        },
        {
          "key": "txtSCenterManifold",
          "label": "Stern to Center Manifold (SCM)(M)",
          "type": "text"
        },
        {
          "key": "txtFCenterManifold",
          "label": "Distance bridge front to center of manifold (M)",
          "type": "text"
        },
        {
          "key": "txtFWASummer",
          "label": "FWA at summer draft(M)",
          "type": "text"
        },
        {
          "key": "txtTPCSummer",
          "label": "TPC immersion at summer draft(M)",
          "type": "text"
        }
      ]
    },
    {
      "title": "Tonnages",
      "fields": [
        {
          "key": "txtNET_TONNAGE",
          "label": "Net Tonnage",
          "type": "text"
        },
        {
          "key": "txtGROSS_TONNAGE",
          "label": "Gross Tonnage",
          "type": "text"
        },
        {
          "key": "txtREGROSS_TONNAGE",
          "label": "Reduced Gross Tonnage (if applicable)",
          "type": "text"
        },
        {
          "key": "txtCANAL_TONNAGE",
          "label": "Suez Canal Tonnage - Gross (SCGT)",
          "type": "text"
        },
        {
          "key": "txtNet_SCNT",
          "label": "Net (SCNT)",
          "type": "text"
        },
        {
          "key": "txtPanamaTonnage",
          "label": "Panama Canal Net Tonnage (PCNT)",
          "type": "text"
        }
      ]
    },
    {
      "title": "Loadline Information",
      "fields": [
        {
          "key": "rdoIsSDWT",
          "label": "Does vessel have multiple SDWT?",
          "type": "radio"
        },
        {
          "key": "txtASSDEADWEIGHT",
          "label": "If yes, what is the maximum assigned deadweight(MT)?",
          "type": "text"
        }
      ]
    },
    {
      "title": "Ownership and Operation",
      "fields": [
        {
          "key": "txtRegisteredOwner",
          "label": "Registered owner - Full style",
          "type": "text"
        },
        {
          "key": "txtTechnicalOperator",
          "label": "Technical operator - Full style",
          "type": "text"
        },
        {
          "key": "txtCommercialOperator",
          "label": "Commercial operator - Full style",
          "type": "text"
        },
        {
          "key": "txtDisponentOwner",
          "label": "Disponent owner - Full style",
          "type": "text"
        }
      ]
    }
  ],
  "tabs": [
    {
      "id": "certification",
      "label": "CERTIFICATION",
      "sections": [
        {
          "title": "Documentation",
          "fields": [
            {
              "key": "rdoPublications",
              "label": "Does vessel have all updated publications as listed in the Vessel Inspection Questionnaire, Chapter 2- Question 2.24, as applicable",
              "type": "radio"
            },
            {
              "key": "rdoOwnerWarrant",
              "label": "Owner warrant that vessel is member of ITOPF and will remain so for the entire duration of this voyage/contract",
              "type": "radio"
            }
          ]
        }
      ],
      "certificates": true
    },
    {
      "id": "crew",
      "label": "CREW MANAGEMENT",
      "sections": [
        {
          "title": "CREW MANAGEMENT",
          "fields": [
            {
              "key": "txtMasterNationality",
              "label": "Nationality of Master",
              "type": "text"
            },
            {
              "key": "txtOfficerNationality",
              "label": "Nationality of Officers",
              "type": "text"
            },
            {
              "key": "txtCrewNationality",
              "label": "Nationality of Crew",
              "type": "text"
            },
            {
              "key": "txtManningAgency",
              "label": "If Officers/Crew employed by a Manning Agency - Full style",
              "type": "text"
            },
            {
              "key": "txtOnboardWorkingLanguage",
              "label": "What is the common working language onboard",
              "type": "text"
            },
            {
              "key": "rdoUnderstandEnglish",
              "label": "Do officers speak and understand English",
              "type": "radio"
            },
            {
              "key": "txtITFSpecialAgreement",
              "label": "In case of Flag Of Convenience, is the ITF Special Agreement on board",
              "type": "text"
            }
          ]
        }
      ]
    },
    {
      "id": "helicopters",
      "label": "HELICOPTERS",
      "sections": [
        {
          "title": "HELICOPTERS",
          "fields": [
            {
              "key": "rdoICSHelicopter",
              "label": "Can the ship comply with the ICS Helicopter Guidelines",
              "type": "radio"
            },
            {
              "key": "txtICSHelicopter",
              "label": "If Yes, state whether winching or landing area provided",
              "type": "text"
            }
          ]
        }
      ]
    },
    {
      "id": "usa",
      "label": "FOR USA CALLS",
      "sections": [
        {
          "title": "FOR USA CALLS",
          "fields": [
            {
              "key": "rdoSpillResponse",
              "label": "Has the vessel Operator submitted a Vessel Spill Response Plan to the US Coast Guard which has been approved by official USCG letter",
              "type": "radio"
            },
            {
              "key": "txtQualifiedIndividual",
              "label": "Qualified individual (QI) - Full style",
              "type": "text"
            },
            {
              "key": "txtSpillResponse",
              "label": "Oil Spill Response Organization (OSRO) -Full style",
              "type": "text"
            },
            {
              "key": "rdoAgreementUS",
              "label": "Has technical operator signed the SCIA / C-TPAT agreement with US customs concerning drug smuggling",
              "type": "radio"
            }
          ]
        }
      ]
    },
    {
      "id": "cargo",
      "label": "CARGO AND BALLAST HANDLING",
      "sections": [
        {
          "title": "Double Hull Vessels",
          "fields": [
            {
              "key": "rdoBulkhead",
              "label": "Is vessel fitted with centerline bulkhead in all cargo tanks",
              "type": "radio"
            },
            {
              "key": "txtBulkhead",
              "label": "If Yes, is bulkhead solid or perforated",
              "type": "text"
            }
          ]
        },
        {
          "title": "Cargo Tank Capacities",
          "fields": [
            {
              "key": "txtCapacity98",
              "label": "Capacity (98%) of each natural segregation with double valve (specify tanks)",
              "type": "text"
            },
            {
              "key": "txtCubicCapacity98",
              "label": "Total cubic capacity (98%, excluding slop tanks)(M3)",
              "type": "text"
            },
            {
              "key": "txtSlopCapacity98",
              "label": "Slop tank(s) capacity (98%)(M3)",
              "type": "text"
            },
            {
              "key": "txtTankCapacity98",
              "label": "Residual/Retention oil tank(s) capacity (98%)(M3), if applicable",
              "type": "text"
            },
            {
              "key": "txtSegregated",
              "label": "Does vessel have Segregated Ballast Tanks (SBT) or Clean Ballast Tanks (CBT):",
              "type": "text"
            }
          ]
        },
        {
          "title": "SBT Vessels",
          "fields": [
            {
              "key": "txtSBTCapacity",
              "label": "What is total capacity of SBT?(M3)",
              "type": "text"
            },
            {
              "key": "txtSDWTPercent",
              "label": "What percentage of SDWT can vessel maintain with SBT only(%)",
              "type": "text"
            },
            {
              "key": "rdoMARPOLAnnex",
              "label": "Does vessel meet the requirements of MARPOL Annex I Reg 18.2: (previously Reg 13.2)",
              "type": "radio"
            }
          ]
        },
        {
          "title": "Cargo Handling",
          "fields": [
            {
              "key": "txtNoOfGradeProduct",
              "label": "How many grades/products can vessel load/discharge with double valve segregation",
              "type": "text"
            },
            {
              "key": "txtCargoRatePerManifold",
              "label": "Maximum loading rate for homogenous cargo per manifold connection(M3/HR)",
              "type": "text"
            },
            {
              "key": "txtCargoRateAllManifold",
              "label": "Maximum loading rate for homogenous cargo loaded simultaneously through all manifolds(M3/HR)",
              "type": "text"
            },
            {
              "key": "rdoCargoTankRestrictions",
              "label": "Are there any cargo tank filling restrictions. If yes, please specify",
              "type": "radio"
            },
            {
              "key": "txtCargoTankRestrictions",
              "label": "If yes, please specify",
              "type": "text"
            }
          ]
        },
        {
          "title": "Pumping Systems",
          "fields": [
            {
              "key": "txtNoOfCargoPumps",
              "label": "How many cargo pumps can be run simultaneously at full capacity",
              "type": "text"
            }
          ]
        },
        {
          "title": "Cargo Control Room",
          "fields": [
            {
              "key": "rdoCargoControlRoom",
              "label": "Is ship fitted with a Cargo Control Room (CCR)",
              "type": "radio"
            },
            {
              "key": "rdoTankInnageCCR",
              "label": "Can tank innage / ullage be read from the CCR",
              "type": "radio"
            }
          ]
        },
        {
          "title": "Gauging and Sampling",
          "fields": [
            {
              "key": "rdoShipOperateUnderClosed",
              "label": "Can ship operate under closed conditions in accordance with ISGOTT",
              "type": "radio"
            },
            {
              "key": "txtTypeOfGaugingSystem",
              "label": "What type of fixed closed tank gauging system is fitted",
              "type": "text"
            },
            {
              "key": "rdoOverFillAlarm",
              "label": "Are overfill (high-high) alarms fitted?",
              "type": "radio"
            },
            {
              "key": "txtOverFillAlarm",
              "label": "If Yes, indicate whether to all tanks or partial",
              "type": "text"
            }
          ]
        },
        {
          "title": "Vapor Emission Control",
          "fields": [
            {
              "key": "rdoVaporReturnSystem",
              "label": "Is a vapor return system (VRS) fitted",
              "type": "radio"
            },
            {
              "key": "txtNoOfVRS",
              "label": "Number of VRS manifolds (per side)",
              "type": "text"
            },
            {
              "key": "txtSizeOfVRS",
              "label": "Size of VRS manifolds (per side)(MM)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Venting",
          "fields": [
            {
              "key": "txtTypeOfVentingSystem",
              "label": "State what type of venting system is fitted",
              "type": "text"
            }
          ]
        },
        {
          "title": "Cargo Manifolds",
          "fields": [
            {
              "key": "rdoOCIMFEdition",
              "label": "Does vessel comply with the latest edition of the OCIMF 'Recommendations for Oil Tanker Manifolds and Associated Equipment",
              "type": "radio"
            },
            {
              "key": "txtCargoConnectionPerSide",
              "label": "What is the number of cargo connections per side",
              "type": "text"
            },
            {
              "key": "txtSizeOfCargoConnection",
              "label": "What is the size of cargo connections",
              "type": "text"
            },
            {
              "key": "txtMaterialOfManifolds",
              "label": "What is the material of the manifold",
              "type": "text"
            }
          ]
        },
        {
          "title": "Manifold Arrangement",
          "fields": [
            {
              "key": "txtManifoldsDistance",
              "label": "Distance between cargo manifold centers(MM)",
              "type": "text"
            },
            {
              "key": "txtShipRailToManifold",
              "label": "Distance ships rail to manifold(MM)",
              "type": "text"
            },
            {
              "key": "txtShipSideDistance",
              "label": "Distance manifold to ships side(MM)",
              "type": "text"
            },
            {
              "key": "txtTopRailCenterManifold",
              "label": "Top of rail to center of manifold(MM)",
              "type": "text"
            },
            {
              "key": "txtDistanceMainDeck",
              "label": "Distance main deck to center of manifold(MM)",
              "type": "text"
            },
            {
              "key": "txtHeightAtBallast",
              "label": "Manifold height above the waterline in normal ballast condition(M)",
              "type": "text"
            },
            {
              "key": "txtHeightAtSDWT",
              "label": "Manifold height above the waterline in normal at SDWT condition(M)",
              "type": "text"
            },
            {
              "key": "txtNumSizeReducers",
              "label": "Number / size reducers",
              "type": "text"
            }
          ]
        },
        {
          "title": "Stern Manifold",
          "fields": [
            {
              "key": "rdoFittedStermManifold",
              "label": "Is vessel fitted with a stern manifold",
              "type": "radio"
            },
            {
              "key": "txtFittedStermManifold",
              "label": "If stern manifold fitted, state size(MM)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Cargo Heating",
          "fields": [
            {
              "key": "txtTypeOfCargoHeating",
              "label": "Type of cargo heating system?",
              "type": "text"
            },
            {
              "key": "rdoTankCoiled",
              "label": "If fitted, are all tanks coiled?",
              "type": "radio"
            },
            {
              "key": "txtTankCoiled",
              "label": "If stern manifold fitted, state size(MM)",
              "type": "text"
            },
            {
              "key": "txtMaximumTempreature",
              "label": "Maximum temperature cargo can be loaded/maintained (F)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Tank Coating",
          "fields": [
            {
              "key": "txtCoatingTypeUsed",
              "label": "If fitted, what type of anodes are used",
              "type": "text"
            }
          ]
        }
      ]
    },
    {
      "id": "inert",
      "label": "INERT GAS AND CRUDE OIL WASHING",
      "sections": [
        {
          "title": "INERT GAS AND CRUDE OIL WASHING",
          "fields": [
            {
              "key": "rdoGasSystem",
              "label": "Is an Inert Gas System (IGS) fitted",
              "type": "radio"
            },
            {
              "key": "txtIGSSupplied",
              "label": "Is IGS supplied by flue gas, inert gas (IG) generator and/or nitrogen",
              "type": "text"
            },
            {
              "key": "txtCrudeOilWashing",
              "label": "Is a Crude Oil Washing (COW) installation fitted",
              "type": "text"
            }
          ]
        }
      ]
    },
    {
      "id": "mooring",
      "label": "MOORING",
      "sections": [
        {
          "title": "Emergency Towing System",
          "fields": [
            {
              "key": "txtETSFType",
              "label": "Type of Emergency Towing system forward",
              "type": "text"
            },
            {
              "key": "txtETSFSWL",
              "label": "SWL of Emergency Towing system forward(MT)",
              "type": "text"
            },
            {
              "key": "txtETSFAFT",
              "label": "Type of Emergency Towing system aft",
              "type": "text"
            },
            {
              "key": "txtETSFSWLAFT",
              "label": "SWL of Emergency Towing system aft(MT)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Anchors",
          "fields": [
            {
              "key": "txtShacklesCableNo",
              "label": "Number of shackles on port cable",
              "type": "text"
            },
            {
              "key": "txtShacklesSCableNo",
              "label": "Number of shackles on starboard cable",
              "type": "text"
            }
          ]
        },
        {
          "title": "Escort Tug",
          "fields": [
            {
              "key": "txtClosedChockSWL",
              "label": "What is SWL of closed chock and/or fairleads of enclosed type on stern(MT)",
              "type": "text"
            },
            {
              "key": "txtClosedChockSize",
              "label": "What is size of closed chock and/or fairleads of enclosed type on stern(MT)",
              "type": "text"
            },
            {
              "key": "txtBOllardSWL",
              "label": "What is SWL of bollard on poopdeck suitable for escort tug(MT)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Bow/Stern Thruster",
          "fields": [
            {
              "key": "txtHPOfBowThruster",
              "label": "What is brake horse power of bow thruster (if fitted)(BHP)",
              "type": "text"
            },
            {
              "key": "txtKWOfBowThruster",
              "label": "What is brake horse power of bow thruster (if fitted)(KW)",
              "type": "text"
            },
            {
              "key": "txtHPOfSternThruster",
              "label": "What is brake horse power of stern thruster (if fitted)(BHP)",
              "type": "text"
            },
            {
              "key": "txtKWOfSternThruster",
              "label": "What is brake horse power of stern thruster (if fitted)(KW)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Single Point Mooring (SPM) Equipment",
          "fields": [
            {
              "key": "rdoOCIMF",
              "label": "Does vessel comply with the latest edition of OCIMF 'Recommendations for Equipment Employed in the Mooring of Vessels at Single Point Moorings (SPM)",
              "type": "radio"
            },
            {
              "key": "rdoChainStopper",
              "label": "Is vessel fitted with chain stopper(s)",
              "type": "radio"
            },
            {
              "key": "txtChainStopper",
              "label": "How many chain stopper(s) are fitted",
              "type": "text"
            },
            {
              "key": "txtChainStopperType",
              "label": "State type of chain stopper(s) fitted",
              "type": "text"
            },
            {
              "key": "txtLoadChainStopper",
              "label": "Safe Working Load (SWL) of chain stopper(s)(MT)",
              "type": "text"
            },
            {
              "key": "txtChainStopperSize",
              "label": "What is the maximum size chain diameter the bow stopper(s) can handle(MM)",
              "type": "text"
            },
            {
              "key": "txtChainStopperDistance",
              "label": "Distance between the bow fairlead and chain stopper/bracket(MM)",
              "type": "text"
            },
            {
              "key": "rdoOCIMFSize",
              "label": "Is bow chock and/or fairlead of enclosed type of OCIMF recommended size (600mm x 450mm)?",
              "type": "radio"
            },
            {
              "key": "txtOCIMFSize",
              "label": "If not, give details of size",
              "type": "text"
            }
          ]
        },
        {
          "title": "Lifting Equipment",
          "fields": [
            {
              "key": "txtCraneNumber",
              "label": "Derrick / Crane description (Number)",
              "type": "text"
            },
            {
              "key": "txtCraneSWL",
              "label": "Derrick / Crane description (SWL)",
              "type": "text"
            },
            {
              "key": "txtCraneLocation",
              "label": "Derrick / Crane description (location)",
              "type": "text"
            },
            {
              "key": "txtCraneOutreach",
              "label": "What is maximum outreach of cranes / derricks outboard of the ship's side(M)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Ship To Ship Transfer (STS)",
          "fields": [
            {
              "key": "rdoOCIMFICS",
              "label": "Does vessel comply with recommendations contained in OCIMF/ICS Ship To Ship Transfer Guide (Petroleum or Liquified Gas, as applicable)",
              "type": "radio"
            }
          ]
        }
      ]
    },
    {
      "id": "misc",
      "label": "MISCELLANEOUS",
      "sections": [
        {
          "title": "Engine Room",
          "fields": [
            {
              "key": "txtPropultionFuel",
              "label": "What type of fuel is used for main propulsion?",
              "type": "text"
            },
            {
              "key": "txtPlantFuel",
              "label": "What type of fuel is used in the generating plant?",
              "type": "text"
            },
            {
              "key": "txtIFO_Capacity",
              "label": "Capacity of bunker tanks - IFO(M3)",
              "type": "text"
            },
            {
              "key": "txtDO_Capacity",
              "label": "Capacity of bunker tanks - MDO/MGO(M3)",
              "type": "text"
            },
            {
              "key": "rdoPitch",
              "label": "Is vessel fitted with fixed or controllable pitch propeller(s)?",
              "type": "radio"
            }
          ]
        },
        {
          "title": "Insurance",
          "fields": [
            {
              "key": "txtP_I_CLUB",
              "label": "P & I Club - Full Style",
              "type": "text"
            },
            {
              "key": "txtP_I_Coverage",
              "label": "P & I Club coverage - pollution liability coverage(USD)",
              "type": "text"
            }
          ]
        },
        {
          "title": "Port State Control",
          "fields": [
            {
              "key": "txtLastPortStateDate",
              "label": "Date of last Port State Control inspection",
              "type": "text"
            },
            {
              "key": "txtLastPortStatePlace",
              "label": "Place of last Port State Control inspection",
              "type": "text"
            },
            {
              "key": "rdoIsReported",
              "label": "Any outstanding deficiencies as reported by any Port State Control",
              "type": "radio"
            },
            {
              "key": "txtReportedDetails",
              "label": "If yes, provide details",
              "type": "text"
            }
          ]
        },
        {
          "title": "Recent Operational History",
          "fields": [
            {
              "key": "rdoIsPolution",
              "label": "Has vessel been involved in a pollution during the past 12 months?",
              "type": "radio"
            },
            {
              "key": "txtPolutionDetails",
              "label": "If yes, provide details",
              "type": "text"
            },
            {
              "key": "rdoIsGrounding",
              "label": "Has vessel been involved in a grounding during the past 12 months?",
              "type": "radio"
            },
            {
              "key": "txtGroundingDetails",
              "label": "If yes, provide details",
              "type": "text"
            },
            {
              "key": "rdoIsCasualty",
              "label": "Has vessel been involved in a serious casualty during the past 12 months?",
              "type": "radio"
            },
            {
              "key": "txtCasualtDetails",
              "label": "If yes, provide details",
              "type": "text"
            },
            {
              "key": "rdoIsAccident",
              "label": "Has vessel been involved in a collision incident during the past 12 months?",
              "type": "radio"
            },
            {
              "key": "txtAccidentDetails",
              "label": "If yes, provide details",
              "type": "text"
            }
          ]
        },
        {
          "title": "Vetting",
          "fields": [
            {
              "key": "txtLastSireDate",
              "label": "Date of last SIRE Inspection",
              "type": "text"
            },
            {
              "key": "selSirePort",
              "label": "Place of last SIRE Inspection",
              "type": "select"
            },
            {
              "key": "txtLastCDIDate",
              "label": "Date of last CDI Inspection",
              "type": "text"
            },
            {
              "key": "selCDIPort",
              "label": "Place of last CDI Inspection",
              "type": "select"
            }
          ]
        }
      ]
    }
  ]
};
