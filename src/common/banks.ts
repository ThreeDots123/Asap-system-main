// src/common/utils/banks.util.ts

import { BadRequestException } from "@nestjs/common";

// A map of Nigerian banks (case-insensitive keys) to their official CBN codes.
const NIGERIAN_BANKS = new Map<string, string>([
  ["access bank", "044"],
  ["citibank nigeria", "023"],
  ["ecobank nigeria", "050"],
  ["fidelity bank", "070"],
  ["first bank", "011"],
  ["first city monument bank", "214"],
  ["globus bank", "00103"],
  ["guaranty trust bank", "058"],
  ["heritage bank", "030"],
  ["keystone bank", "082"],
  ["polaris bank", "076"],
  ["providus bank", "101"],
  ["stanbic ibtc bank", "221"],
  ["standard chartered bank", "068"],
  ["sterling bank", "232"],
  ["suntrust bank", "100"],
  ["titan trust bank", "102"],
  ["union bank of nigeria", "032"],
  ["united bank for africa", "033"],
  ["unity bank", "215"],
  ["wema bank", "035"],
  ["zenith bank", "057"],
  // Add more banks as needed
]);

export default NIGERIAN_BANKS;
