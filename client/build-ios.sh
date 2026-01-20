#!/bin/bash

# Build iOS app for ZK Geo Offline

echo "Building ZK Geo for iOS..."

# 1. Build web assets
echo "Building web assets..."
npm run build

# 2. Sync to iOS
echo "Syncing to iOS..."
npx cap sync ios

# 3. Open in Xcode (for development)
echo "Opening in Xcode..."
npx cap open ios

echo ""
echo "iOS Build Instructions:"
echo "1. In Xcode, select your development team"
echo "2. Choose a device or simulator"
echo "3. Press Cmd+R to build and run"
echo ""
echo "For production build:"
echo "1. Select 'Generic iOS Device' as target"
echo "2. Go to Product > Archive"
echo "3. Distribute via App Store Connect or Ad Hoc"

# Alternative: Build from command line (requires Xcode)
# cd ios/App
# xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath build/App.xcarchive archive
# xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build -exportOptionsPlist exportOptions.plist