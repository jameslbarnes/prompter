// DOM Elements Module
// Central location for all DOM element references used across the application

// Interview management elements
const interviewsList = document.getElementById('interviewsList');
const saveCopilotInterview = document.getElementById('saveCopilotInterview');
const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
const openInterviewPreviewBtn = document.getElementById('beginInterviewBtn'); // Updated to new button ID

// Copilot/Chat elements
const copilotInput = document.getElementById('copilotInput');
const sendCopilotMessage = document.getElementById('sendCopilotMessage');
const copilotMessages = document.getElementById('copilotMessages');
const thinkingIndicator = document.getElementById('thinkingIndicator');
const copilotPanel = document.getElementById('copilotPanel');

// File management elements
const contextFileInput = document.getElementById('contextFileInput');
const uploadedFilesList = document.getElementById('uploadedFilesList');
const fileUploadSection = document.getElementById('fileUploadSection');

// Specification UI elements
const specificationNullState = document.getElementById('specificationNullState');
const specificationContentWrapper = document.getElementById('specificationContentWrapper');
const shareUrlBtn = document.getElementById('shareUrlBtn');
const specTabsContainer = document.querySelector('.spec-tabs');
const specTabContents = specificationContentWrapper?.querySelectorAll('.spec-tab-content');
const specHasExternalDocumentCheckbox = document.getElementById('specHasExternalDocument');
const specEnableWebSearchCheckbox = document.getElementById('specEnableWebSearch');
const specEnableThinkingCheckbox = document.getElementById('specEnableThinking');
const specEnableMemoryServiceCheckbox = document.getElementById('specEnableMemoryService');
const specFollowupModelSelect = document.getElementById('specFollowupModel');

// Header elements
const headerElement = document.querySelector('.header');
const activeInterviewHeaderTitleElement = document.getElementById('activeInterviewHeaderTitle');

// Responses tab elements
const responsesLoadingIndicator = document.getElementById('responsesLoadingIndicator');
const responsesListContainer = document.getElementById('responsesListContainer');
const noResponsesMessage = document.getElementById('noResponsesMessage');
const responsesErrorMessage = document.getElementById('responsesErrorMessage');
const responsesStatisticsSection = document.getElementById('responsesStatisticsSection');
const totalInterviewsCount = document.getElementById('totalInterviewsCount');
const uniqueUsersCount = document.getElementById('uniqueUsersCount');
const avgResponsesPerInterview = document.getElementById('avgResponsesPerInterview');
const lastInterviewDate = document.getElementById('lastInterviewDate');
const avgInterviewDuration = document.getElementById('avgInterviewDuration');
const mostActiveUser = document.getElementById('mostActiveUser');

// Group synthesis elements - REMOVED

// Admin report elements
const specAdminReportPromptTextarea = document.getElementById('specAdminReportPrompt');
const previewAdminReportContentDiv = document.getElementById('previewAdminReportContent');
// Removed: adminReportDisplaySection and related elements

// Report detail panel elements
const reportDetailPanel = document.getElementById('reportDetailPanel');
const closeReportPanelXBtn = document.getElementById('closeReportPanelXBtn');
const panelNavButtons = reportDetailPanel?.querySelectorAll('.panel-nav-button');
const interviewContent = document.getElementById('interviewContent');
const reportContent = document.getElementById('reportContent');
const interviewContentBody = document.getElementById('interviewContentBody');
const reportContentBody = document.getElementById('reportContentBody');
const reportDetailOverlay = document.getElementById('reportDetailOverlay');
const regenerateUserReportBtn = document.getElementById('regenerateUserReportBtn');
const downloadUserReportAudioBtn = document.getElementById('downloadUserReportAudioBtn');
const viewUserReportBtn = document.getElementById('viewUserReportBtn');

// Interview preview panel elements
const interviewLivePreviewPanel = document.getElementById('interviewLivePreviewPanel');
const closeInterviewLivePreviewPanelBtn = document.getElementById('closeInterviewLivePreviewPanelBtn');
const livePreviewIframe = document.getElementById('livePreviewIframe');
const refreshLivePreviewFrameBtn = document.getElementById('refreshLivePreviewFrameBtn');
const interviewLivePreviewOverlay = document.getElementById('interviewLivePreviewOverlay');

// Global audio player elements
const globalAudioPlayerContainer = document.getElementById('globalAudioPlayerContainer');
const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
const globalPlayPauseBtn = document.getElementById('globalPlayPauseBtn');
const globalSeekBar = document.getElementById('globalSeekBar');
const globalVolumeBar = document.getElementById('globalVolumeBar');
const globalCurrentTime = document.getElementById('globalCurrentTime');
const globalDuration = document.getElementById('globalDuration');
const globalTrackTitle = document.getElementById('globalTrackTitle');
const globalTrackArtist = document.getElementById('globalTrackArtist');

// User settings panel elements
const userSettingsBtn = document.getElementById('userSettingsBtn');
const userSettingsPanel = document.getElementById('userSettingsPanel');

// Pricing panel elements
const pricingBtn = document.getElementById('pricingBtn');
const pricingPanel = document.getElementById('pricingPanel');
const closePricingPanelBtn = document.getElementById('closePricingPanelBtn');
const pricingOverlay = document.getElementById('pricingOverlay');
const pricingIframe = document.getElementById('pricingIframe');
const closeUserSettingsPanelBtn = document.getElementById('closeUserSettingsPanelBtn');
const userSettingsOverlay = document.getElementById('userSettingsOverlay');
const userDisplayNameInput = document.getElementById('userDisplayNameInput');
const userOrganizationInput = document.getElementById('userOrganizationInput');
const saveUserSettingsBtn = document.getElementById('saveUserSettingsBtn');

// Journal/Activity view elements
const myJournalBtn = document.getElementById('myActivityBtn');
const journalViewContainer = document.getElementById('activityFeedContainer');
const journalEntriesList = document.getElementById('activityFeedDisplayArea');
const configPanel = document.getElementById('configPanel');

// Audio status elements (legacy - might not be in use)
const listenToReportAdminBtn = document.getElementById('listenToReportAdminBtn');
const adminReportAudioPlayerContainer = document.getElementById('adminReportAudioPlayerContainer');
const adminReportAudioPlayer = document.getElementById('adminReportAudioPlayer');
const adminAudioStatusMessage = document.getElementById('adminAudioStatusMessage'); 