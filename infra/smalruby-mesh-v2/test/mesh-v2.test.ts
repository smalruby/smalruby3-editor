import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as MeshV2 from '../lib/mesh-v2-stack';

describe('MeshV2Stack', () => {
  test('AppSync API and DynamoDB Table Created', () => {
    const app = new cdk.App();
    const stack = new MeshV2.MeshV2Stack(app, 'MyTestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'MeshV2Table-stg'
    });

    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      Name: 'MeshV2Api-stg'
    });
  });

  test('Polling Resolvers and Environment Variables', () => {
    const app = new cdk.App();
    const stack = new MeshV2.MeshV2Stack(app, 'MyTestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    const template = Template.fromStack(stack);

    // Environment Variables
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      EnvironmentVariables: {
        MESH_EVENT_TTL_SECONDS: Match.anyValue(),
        MESH_POLLING_INTERVAL_SECONDS: Match.anyValue()
      }
    });

    // Resolvers
    // 1. listGroupsByDomain (Unit)
    // 2. listGroupStatuses (Unit)
    // 3. findNodeMetadata (Function for getNodeStatus) -> Wait, this is Function, not Resolver
    // 4. fetchNodeStatus (Function for getNodeStatus) -> Wait, this is Function, not Resolver
    // 5. getNodeStatus (Pipeline Resolver)
    // 6. listNodesInGroup (Unit)
    // 7. createGroup (Pipeline Resolver)
    // 8. joinGroup (Pipeline Resolver)
    // 9. renewHeartbeat (Pipeline Resolver)
    // 10. sendMemberHeartbeat (Pipeline Resolver)
    // 11. reportDataByNode (Pipeline Resolver)
    // 12. fireEventsByNode (Pipeline Resolver)
    // 13. recordEventsByNode (Pipeline Resolver)
    // 14. getEventsSince (Unit)
    // 15. dissolveGroup (Lambda)
    // 16. createDomain (Lambda)
    // 17. leaveGroup (Lambda)
    // Functions are different resources (AWS::AppSync::Function)

    // Let's count Resolvers again:
    // listGroupsByDomain, listGroupStatuses, getNodeStatus, listNodesInGroup, createGroup,
    // joinGroup, renewHeartbeat, sendMemberHeartbeat, reportDataByNode, fireEventsByNode,
    // recordEventsByNode, getEventsSince, dissolveGroup, createDomain, leaveGroup.
    // That's 15.

    template.resourceCountIs('AWS::AppSync::Resolver', 15);

    template.hasResourceProperties('AWS::AppSync::Resolver', {
      FieldName: 'recordEventsByNode',
      TypeName: 'Mutation'
    });

    template.hasResourceProperties('AWS::AppSync::Resolver', {
      FieldName: 'getEventsSince',
      TypeName: 'Query'
    });
  });
});

