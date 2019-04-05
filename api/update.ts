import { IContainer } from '../models/container';
import { RcStatusApp } from '../RcStatusApp';
import { ApiResponseUtilities } from '../utils/apiResponses';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IncidentStatusEnum } from '../enums/incidentStatus';

export class UpdateStatusApi extends ApiEndpoint {
    constructor(app: RcStatusApp) {
        super(app);

        this.path = 'update';
    }

    public async get(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<IApiResponse> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const updateAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'update');
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc, updateAssoc]);

        if (existing.length < 1 && !request.query.status) {
            return ApiResponseUtilities.getAutoClosingHtml();
        }

        const record = existing[0] as IContainer;
        const { status } = request.query;

        this.app.getLogger().log(`Setting the status of the incident update to ${ IncidentStatusEnum[status] }`);

        record.update.status = IncidentStatusEnum[status];

        await persis.removeByAssociations([userAssoc, roomAssoc, updateAssoc]);
        await persis.createWithAssociations(record, [userAssoc, roomAssoc, updateAssoc]);

        return ApiResponseUtilities.getAutoClosingHtml();
    }
}
