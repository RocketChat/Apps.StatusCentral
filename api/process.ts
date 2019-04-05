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

        if (request.query.which === 'update') {
            return this.handleUpdate(request, read, modify, http, persis);
        }

        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length === 1 && request.query.step) {
            const record = existing[0] as IContainer;

            this.app.getLogger().log(`Going to the step: ${ request.query.step } from ${ record.step }`, record);

            switch (request.query.step) {
                case StepEnum.Status:
                    await this.statusApp.getCreationWorker().sendStatusSelection(record, read, modify);
                    break;
                case StepEnum.Describe:
                    await this.statusApp.getCreationWorker().askForDescribeCommand(record, read, modify);
                    break;
                case StepEnum.Services:
                    await this.statusApp.getCreationWorker().sendServiceSelection(record, read, modify, http);
                    break;
                case StepEnum.Review:
                    await this.statusApp.getCreationWorker().sendDataForReview(record, read, modify);
                    break;
                case StepEnum.Publish:
                    return await this.handlePublish(record, read, modify, http, persis, [userAssoc, roomAssoc]);
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

    // tslint:disable-next-line:max-line-length
    private async handlePublish(record: IContainer, read: IRead, modify: IModify, http: IHttp, persis: IPersistence, assocs: Array<RocketChatAssociationRecord>): Promise<IApiResponse> {
        let result = false;

        if (assocs.length === 2) {
            result = await this.statusApp.getCreationWorker().publishIncident(record, read, modify, http);
        } else if (assocs.length === 3) {
            result = await this.statusApp.getUpdateWorker().publishUpdate(record, read, modify, http);
        }

        if (result) {
            await persis.removeByAssociations(assocs);
            this.app.getLogger().log('Item created successfully', record);
        }

        return ApiResponseUtilities.getAutoClosingHtml();
    }

    // tslint:disable-next-line:max-line-length
    private async handleUpdate(request: IApiRequest, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<IApiResponse> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const updateAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'update');
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc, updateAssoc]);

        if (existing.length === 1 && request.query.step) {
            const record = existing[0] as IContainer;

            this.app.getLogger().log(`Going to the step: ${ request.query.step } from ${ record.step }`, record);

            switch (request.query.step) {
                case StepEnum.Describe:
                    await this.statusApp.getUpdateWorker().askForExplainCommand(record, read, modify);
                    break;
                case StepEnum.Review:
                    await this.statusApp.getUpdateWorker().sendDataForReview(record, read, modify);
                    break;
                case StepEnum.Publish:
                    return await this.handlePublish(record, read, modify, http, persis, [userAssoc, roomAssoc, updateAssoc]);
                default:
                    this.app.getLogger().warn(`Unknown step: ${ request.query.step }`);
                    break;
            }

            await persis.removeByAssociations([userAssoc, roomAssoc, updateAssoc]);
            await persis.createWithAssociations(record, [userAssoc, roomAssoc, updateAssoc]);

            this.app.getLogger().log(record);
        }

        return ApiResponseUtilities.getAutoClosingHtml();
    }
}
