/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { Progress } from 'vscode';
import { AzureWizardExecuteStep } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
import { nonNullProp, nonNullValueAndProp } from '../utils/nonNull';
import { getAppServicePlanModelKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 120;

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newPlanName: string = nonNullProp(wizardContext, 'newPlanName');
        const rgName: string = nonNullValueAndProp(wizardContext.resourceGroup, 'name');

        const findingAppServicePlan: string = localize('FindingAppServicePlan', 'Ensuring App Service plan "{0}" exists...', newPlanName);
        const creatingAppServicePlan: string = localize('CreatingAppServicePlan', 'Creating App Service plan "{0}"...', newPlanName);
        const foundAppServicePlan: string = localize('FoundAppServicePlan', 'Successfully found App Service plan "{0}".', newPlanName);
        const createdAppServicePlan: string = localize('CreatedAppServicePlan', 'Successfully created App Service plan "{0}".', newPlanName);
        ext.outputChannel.appendLog(findingAppServicePlan);

        const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);
        const existingPlan: WebSiteManagementModels.AppServicePlan | undefined = await tryGetAppServicePlan(client, rgName, newPlanName);

        if (existingPlan) {
            wizardContext.plan = existingPlan;
            ext.outputChannel.appendLog(foundAppServicePlan);
        } else {
            ext.outputChannel.appendLog(creatingAppServicePlan);
            progress.report({ message: creatingAppServicePlan });
            const isElasticPremium: boolean = wizardContext.newPlanSku?.family?.toLowerCase() === 'ep';
            wizardContext.plan = await client.appServicePlans.createOrUpdate(rgName, newPlanName, {
                kind: getAppServicePlanModelKind(wizardContext.newSiteKind, nonNullProp(wizardContext, 'newSiteOS')),
                sku: nonNullProp(wizardContext, 'newPlanSku'),
                location: nonNullValueAndProp(wizardContext.location, 'name'),
                reserved: wizardContext.newSiteOS === WebsiteOS.linux,  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
                maximumElasticWorkerCount: isElasticPremium ? 20 : undefined
            });
            ext.outputChannel.appendLog(createdAppServicePlan);
        }
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.plan;
    }
}
