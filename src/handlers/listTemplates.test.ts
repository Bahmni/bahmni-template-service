/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { Request, Response } from 'express';

import { listTemplates } from './listTemplates';

jest.mock('../template/store');

const mockStore = jest.requireMock('../template/store');

describe('listTemplates', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {};
    jsonSpy = jest.fn();
    mockRes = {
      json: jsonSpy,
    };
  });

  it('returns empty array when no templates exist', () => {
    mockStore.templateStore = {
      list: jest.fn().mockReturnValue([]),
    };

    listTemplates(mockReq as Request, mockRes as Response);

    expect(jsonSpy).toHaveBeenCalledWith({ templates: [] });
  });

  it('returns list of templates with id and name only', () => {
    const mockTemplates = [
      {
        id: 'template1',
        name: 'First Template',
        folder: 'template1',
        extraField: 'should not be included',
      },
      {
        id: 'template2',
        name: 'Second Template',
        folder: 'template2',
        anotherField: 'also not included',
      },
    ];

    mockStore.templateStore = {
      list: jest.fn().mockReturnValue(mockTemplates),
    };

    listTemplates(mockReq as Request, mockRes as Response);

    expect(jsonSpy).toHaveBeenCalledWith({
      templates: [
        { id: 'template1', name: 'First Template' },
        { id: 'template2', name: 'Second Template' },
      ],
    });
  });

  it('maps template entries correctly from template store', () => {
    const mockTemplates = [
      { id: 'discharge', name: 'Discharge Summary', folder: 'discharge' },
      { id: 'prescription', name: 'Prescription', folder: 'prescription' },
      { id: 'lab-report', name: 'Lab Report', folder: 'lab-report' },
    ];

    mockStore.templateStore = {
      list: jest.fn().mockReturnValue(mockTemplates),
    };

    listTemplates(mockReq as Request, mockRes as Response);

    const response = jsonSpy.mock.calls[0][0];
    expect(response.templates).toHaveLength(3);
    expect(response.templates[0]).toEqual({
      id: 'discharge',
      name: 'Discharge Summary',
    });
    expect(response.templates[1]).toEqual({
      id: 'prescription',
      name: 'Prescription',
    });
    expect(response.templates[2]).toEqual({
      id: 'lab-report',
      name: 'Lab Report',
    });
  });

  it('calls templateStore.list once', () => {
    mockStore.templateStore = {
      list: jest.fn().mockReturnValue([]),
    };

    listTemplates(mockReq as Request, mockRes as Response);

    expect(mockStore.templateStore.list).toHaveBeenCalledTimes(1);
  });
});
