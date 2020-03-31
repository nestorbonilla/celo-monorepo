import { createNamespaceIfNotExists } from './cluster'
import { doCheckOrPromptIfStagingOrProduction, envVar, fetchEnv } from './env-utils'
import { execCmd, execCmdWithExitOnFailure } from './utils'
import { installAndEnableMetricsDeps, redeployTiller } from './helm_deploy'

// switchToClusterFromEnv configures kubectl to connect to the AKS cluster
// TODO(trevor): add project switching as well
export async function switchToClusterFromEnv(
  celoEnv: string,
  checkOrPromptIfStagingOrProduction = true
) {
  if (checkOrPromptIfStagingOrProduction) {
    await doCheckOrPromptIfStagingOrProduction()
  }

  let currentCluster = null
  try {
    ;[currentCluster] = await execCmd('kubectl config current-context')
  } catch (error) {
    console.info('No cluster currently set')
  }

  const clusterName = fetchEnv(envVar.AZURE_KUBERNETES_CLUSTER_NAME)
  const resourceGroup = fetchEnv(envVar.AZURE_KUBERNETES_RESOURCE_GROUP)

  if (currentCluster === null || currentCluster.trim() !== clusterName) {
    await execCmdWithExitOnFailure(
      `az aks get-credentials --resource-group ${resourceGroup} --name ${clusterName}`
    )
  }
  await setupCluster(celoEnv)
}

// setupCluster is idempotent-- it will only make changes that have not been made
// before. Therefore, it's safe to be called for a cluster that's been fully set up before
async function setupCluster(celoEnv: string) {
  await createNamespaceIfNotExists(celoEnv)

  console.info('Performing any cluster setup that needs to be done...')

  await redeployTiller()
  await installAndEnableMetricsDeps(false)
}