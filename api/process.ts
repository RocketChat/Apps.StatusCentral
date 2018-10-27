import { RcStatusApp } from '../RcStatusApp';
import { ApiResponseUtilities } from '../utils/apiResponses';
import { StepEnum } from './../enums/step';
import { IContainer } from './../models/container';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { ApiEndpoint } from '@rocket.chat/apps-engine/definition/api/ApiEndpoint';
import { IApiEndpointInfo } from '@rocket.chat/apps-engine/definition/api/IApiEndpointInfo';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export class ProcessStepperApi extends ApiEndpoint {
    private statusApp: RcStatusApp;

    constructor(app: RcStatusApp) {
        super(app);

        this.statusApp = app;
        this.path = 'process';
    }

    public async get(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<IApiResponse> {
        this.app.getLogger().log(request);

        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length === 1 && request.query.step) {
            const record = existing[0] as IContainer;

            this.app.getLogger().log(`Going to the step: ${ request.query.step } from ${ record.step }`, record);

            switch (request.query.step) {
                case StepEnum.Services:
                    await this.statusApp.getCreationWorker().sendServiceSelection(record, read, modify, http);
                    break;
                case StepEnum.Status:
                    await this.statusApp.getCreationWorker().sendStatusSelection(record, read, modify);
                    break;
                case StepEnum.Review:
                    await this.statusApp.getCreationWorker().sendDataForReview();
                    break;
                default:
                    this.app.getLogger().warn(`Unknown step: ${ request.query.step }`);
                    break;
            }

            await persis.removeByAssociations([userAssoc, roomAssoc]);
            await persis.createWithAssociations(record, [userAssoc, roomAssoc]);

            this.app.getLogger().log(record);
        }

        return ApiResponseUtilities.getAutoClosingHtml();
    }
}
