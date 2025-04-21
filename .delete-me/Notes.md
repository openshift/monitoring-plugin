Admin 
1. [] Alerting Page 
    [] Can navigate to Alerts, Silences, Alerting Rules Pages
    [] Can use filters to change URL on Alerts, Silences, Alerting Rules Pages
    [] Alerts Page 
        [] Expand a row in the AggregatedTableRow > Under name column click the Alert > should go to Alert Details Page
        [] Link to 'Silence alerts' should go to the New Silences Page 
    [] Silences Page 
        [] Can navigate to Silence Detail Page 
        [] Can navigate to 'Create Silences' page 
        [] Can navigate to 'Edit Silences' Page
        [] Can navigate to Silences > Silence Detail > Firing Alerts > Click on Alert > Silenced By > Options Kebab > Edit Silence Page  
    [] Alert Rules Page 
        [] Clicking on an alert > should navigate to AlertRulesDetailPage 
2. [] Metrics 
    [] Can navigate to Metrics Page 
3. [] Dashboards
    [] Can navigate to Metrics Page 
    [] Chaning dashboards from 'Dashboard' dropdown will update the URL
4. [] Targets
    [] Can navigate to /targets 
    [] Can click on 'Endpoints' link 
5. [x] Incidents 
6. [] Dashboards (Perses)
    [] Need to check this on a cluster because of issues running Perses locally 
Virt-monitoring 
1. ^ same as admin 






Components that are replaced 
1. replace { match }  >> const params = useParams(); 
2. replace { history } >>  const params = useNavigate();
3. replace { location } >> const location = useLocation(); 
4. remove `RouterComponentProps` and `withRouter` >> no longer needed to wrap components in withRouter because of the replacement of implicit props: match, history, and location 




Clean up 
1. Remove .delete-me file 
2. Remove dev-mock-dashboard-config.tsx and remove changes to useLegacyDashboards.tsx 