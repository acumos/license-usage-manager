# ===============LICENSE_START================================================
# Acumos Apache-2.0
# ============================================================================
# Copyright (C) 2019 Nordix Foundation.
#  ============================================================================
#  This Acumos software file is distributed by Nordix Foundation
#  under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at

#       http://www.apache.org/licenses/LICENSE-2.0

#  This file is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#  ===============LICENSE_END==================================================


releaseName=lum-test
namespace=lum-test
pathToLumHelmChart=../lum-helm/
  
helm del --purge ${releaseName}
kubectl delete namespace ${namespace};
kubectl wait --for=delete ns/${namespace} --timeout=60s
kubectl delete pvc data-${releaseName}-postgresql-0 -n ${namespace};
kubectl wait --for=delete pvc/data-${releaseName}-postgresql-0 -n ${namespace} --timeout=60s

helm dependency build  ${pathToLumHelmChart}
helm install -f helm-simple.values.yaml --debug --name $releaseName  --namespace ${namespace}  ${pathToLumHelmChart}
