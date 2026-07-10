import { Router } from 'express';
import { compareVessels, getFleetList } from '../services/fleetService.js';
import {
  createVesselPrimary,
  getVesselPrimary,
  getVesselPrimaryLookups,
  updateVesselPrimary,
} from '../services/vesselPrimaryService.js';
import {
  getTankerParticulars,
  updateTankerParticulars,
} from '../services/vesselTankerParticularsService.js';
import { generateTankerParticularsPdf } from '../services/vesselTankerParticularsPdfService.js';
import {
  getCommercialParameters,
  saveCommercialParameters,
} from '../services/commercialParametersService.js';
import { generateCommercialParametersPdf } from '../services/commercialParametersPdfService.js';
import { mergeVesselAttachments, particularsUpload, vesselUpload } from '../utils/vesselAttachments.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getFleetList({
      selBType: req.query.selBType,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 10,
      search: req.query.search || '',
      sortColumn: Number(req.query.sortColumn) || 0,
      sortDir: req.query.sortDir || 'desc',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load fleet list.' });
  }
});

router.post('/compare', async (req, res) => {
  try {
    const vesselIds = Array.isArray(req.body?.vesselIds) ? req.body.vesselIds : [];
    const data = await compareVessels(vesselIds);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to compare vessels.' });
  }
});

router.get('/vessel/new', async (_req, res) => {
  try {
    const lookups = await getVesselPrimaryLookups();
    res.json({ lookups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load vessel form.' });
  }
});

router.post('/vessel', vesselUpload, async (req, res) => {
  try {
    const { attachment, attachmentName } = mergeVesselAttachments([], [], req.files);
    const vessel = await createVesselPrimary({
      businessTypeId: req.body.businessTypeId,
      vesselTypeId: req.body.vesselTypeId,
      imoNo: req.body.imoNo,
      vesselName: req.body.vesselName,
      vesselCode: req.body.vesselCode,
      yearBuilt: req.body.yearBuilt,
      flagId: req.body.flagId,
      dwt: req.body.dwt,
      draftM: req.body.draftM,
      loa: req.body.loa,
      extBreadth: req.body.extBreadth,
      grtNrt: req.body.grtNrt,
      nrt: req.body.nrt,
      grain: req.body.grain,
      bale: req.body.bale,
      noh: req.body.noh,
      noha: req.body.noha,
      hatchSize: req.body.hatchSize,
      cargoGear: req.body.cargoGear,
      craneSize: req.body.craneSize,
      grabSize: req.body.grabSize,
      gasCargoTanks: req.body.gasCargoTanks,
      gasTankCapacity: req.body.gasTankCapacity,
      gasCargoPumps: req.body.gasCargoPumps,
      gasMainCargoPumps: req.body.gasMainCargoPumps,
      sizeOfManifolds: req.body.sizeOfManifolds,
      gasSbtCapacity: req.body.gasSbtCapacity,
      tankerCapacity: req.body.tankerCapacity,
      noOfGrade: req.body.noOfGrade,
      tankerCargoPump: req.body.tankerCargoPump,
      tankerSbtCapacity: req.body.tankerSbtCapacity,
      tankerPumpMainCap: req.body.tankerPumpMainCap,
      piVendorId: req.body.piVendorId,
      classSocId: req.body.classSocId,
      ownerVendorId: req.body.ownerVendorId,
      remarks: req.body.remarks,
      attachment,
      attachmentName,
    });
    res.status(201).json({ vessel, msg: 0 });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create vessel.', msg: 1 });
  }
});

router.get('/vessel/:vesselId/primary', async (req, res) => {
  try {
    const [vessel, lookups] = await Promise.all([
      getVesselPrimary(req.params.vesselId),
      getVesselPrimaryLookups(),
    ]);
    if (!vessel) {
      res.status(404).json({ message: 'Vessel not found.' });
      return;
    }
    res.json({ vessel, lookups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load vessel.' });
  }
});

router.post('/vessel/:vesselId/primary', vesselUpload, async (req, res) => {
  try {
    const existingFiles = String(req.body.existingFiles || '').split(',').filter(Boolean);
    const existingNames = String(req.body.existingNames || '').split(',').filter(Boolean);
    const { attachment, attachmentName } = mergeVesselAttachments(
      existingFiles,
      existingNames,
      req.files,
    );

    const vessel = await updateVesselPrimary(req.params.vesselId, {
      businessTypeId: req.body.businessTypeId,
      vesselTypeId: req.body.vesselTypeId,
      imoNo: req.body.imoNo,
      vesselName: req.body.vesselName,
      vesselCode: req.body.vesselCode,
      yearBuilt: req.body.yearBuilt,
      flagId: req.body.flagId,
      dwt: req.body.dwt,
      draftM: req.body.draftM,
      loa: req.body.loa,
      extBreadth: req.body.extBreadth,
      grtNrt: req.body.grtNrt,
      nrt: req.body.nrt,
      grain: req.body.grain,
      bale: req.body.bale,
      noh: req.body.noh,
      noha: req.body.noha,
      hatchSize: req.body.hatchSize,
      cargoGear: req.body.cargoGear,
      craneSize: req.body.craneSize,
      grabSize: req.body.grabSize,
      gasCargoTanks: req.body.gasCargoTanks,
      gasTankCapacity: req.body.gasTankCapacity,
      gasCargoPumps: req.body.gasCargoPumps,
      gasMainCargoPumps: req.body.gasMainCargoPumps,
      sizeOfManifolds: req.body.sizeOfManifolds,
      gasSbtCapacity: req.body.gasSbtCapacity,
      tankerCapacity: req.body.tankerCapacity,
      noOfGrade: req.body.noOfGrade,
      tankerCargoPump: req.body.tankerCargoPump,
      tankerSbtCapacity: req.body.tankerSbtCapacity,
      tankerPumpMainCap: req.body.tankerPumpMainCap,
      piVendorId: req.body.piVendorId,
      classSocId: req.body.classSocId,
      ownerVendorId: req.body.ownerVendorId,
      remarks: req.body.remarks,
      attachment,
      attachmentName,
    });
    res.json({ vessel, msg: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to update vessel.', msg: 1 });
  }
});

router.get('/vessel/:vesselId/particulars', async (req, res) => {
  try {
    const data = await getTankerParticulars(req.params.vesselId);
    if (!data) {
      res.status(404).json({ message: 'Vessel not found.' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load vessel particulars.' });
  }
});

router.get('/vessel/:vesselId/particulars-tanker', async (req, res) => {
  try {
    const data = await getTankerParticulars(req.params.vesselId);
    if (!data) {
      res.status(404).json({ message: 'Vessel not found.' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load vessel particulars.' });
  }
});

router.get('/vessel/:vesselId/particulars/pdf', async (req, res) => {
  try {
    const result = await generateTankerParticularsPdf(req.params.vesselId);
    if (!result) {
      res.status(404).json({ message: 'Vessel not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to generate vessel particulars PDF.' });
  }
});

function groupParticularsUploads(files = []) {
  const grouped = {};
  files.forEach((file) => {
    const match = /^attach_file_(\d+)$/.exec(file.fieldname);
    if (!match) return;
    const index = Number(match[1]);
    if (!grouped[index]) grouped[index] = [];
    grouped[index].push(file);
  });
  return grouped;
}

router.post('/vessel/:vesselId/particulars', particularsUpload, async (req, res) => {
  try {
    const fields = JSON.parse(req.body.fields || '{}');
    const certificates = JSON.parse(req.body.certificates || '[]');
    const filesByIndex = groupParticularsUploads(req.files);

    const result = await updateTankerParticulars(
      req.params.vesselId,
      { fields, certificates },
      filesByIndex,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to update vessel particulars.' });
  }
});

router.get('/vessel/:vesselId/commercial-parameters', async (req, res) => {
  try {
    const data = await getCommercialParameters(req.params.vesselId);
    if (!data) {
      res.status(404).json({ message: 'Vessel not found.' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load commercial parameters.' });
  }
});

router.post('/vessel/:vesselId/commercial-parameters', async (req, res) => {
  try {
    const result = await saveCommercialParameters(req.params.vesselId, req.body ?? {});
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to save commercial parameters.' });
  }
});

router.get('/vessel/:vesselId/commercial-parameters/pdf', async (req, res) => {
  try {
    const result = await generateCommercialParametersPdf(req.params.vesselId);
    if (!result) {
      res.status(404).json({ message: 'Vessel not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to generate commercial parameters PDF.' });
  }
});

export default router;
