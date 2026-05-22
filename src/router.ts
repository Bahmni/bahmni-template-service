/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { Router } from 'express';
import { HEALTH_PATH, RENDER_PATH, TEMPLATES_PATH } from './constants';
import { healthCheck, listTemplates, renderTemplate } from './handlers';

const router = Router();

router.get(TEMPLATES_PATH, listTemplates);
router.post(RENDER_PATH, renderTemplate);
router.get(HEALTH_PATH, healthCheck);

export default router;
