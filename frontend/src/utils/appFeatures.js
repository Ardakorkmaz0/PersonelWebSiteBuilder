// Plain-language descriptions for the three starting paths in the guide.
export const APP_FEATURES = [
  {
    id: 'empty', icon: 'page', tone: 'accent', tag: 'No coding needed',
    title: 'Design from scratch',
    summary: 'Build your first website by placing ready-made blocks on an empty page.',
    points: [
      'Add text, images and buttons with drag and drop',
      'Adjust the design for phones and computers',
      'Save your work and publish when you are ready',
    ],
  },
  {
    id: 'upload', icon: 'upload', tone: 'info', tag: 'For an existing page',
    title: 'Upload your HTML',
    summary: 'Bring a page you already have and keep working on it in the editor.',
    points: [
      'Upload an HTML file or paste its code',
      'Edit the page visually or open its source code',
      'Try buttons and interactions in live view',
    ],
  },
  {
    id: 'local', icon: 'folder', tone: 'success', tag: 'For a project folder',
    title: 'Open your local project',
    summary: 'Choose a folder on your computer and work with its HTML, CSS and JavaScript files.',
    points: [
      'Open your existing files together',
      'Preview the page with its styles and scripts',
      'Save changes directly to your project files',
    ],
    caveat: 'Early version. Use Chrome or Edge and keep a backup of important projects.',
  },
]
