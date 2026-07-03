/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { Request, Response } from 'express';

import { templateStore } from '../template/store';

export function listTemplates(_req: Request, res: Response): void {
  const templates = templateStore
    .list()
    .map((t) => ({ id: t.id, name: t.name }));
  res.json({ templates });
}
